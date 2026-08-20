"use client";

import { useRef, useState } from "react";
import type { NovaData } from "./nova-store";

type Mode = "merge" | "replace";
type BackupPreview = { data: NovaData; name: string; size: number };

const idPattern = /^[a-zA-Z0-9_-]{3,120}$/;
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const statuses = new Set(["todo", "doing", "done"]);

function validTimestamp(value: unknown) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function uniqueIds(items: Array<{ id: string }>) {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function parseBackup(raw: unknown): NovaData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Файл не містить резервну копію NOVA");
  const container = raw as Record<string, unknown>;
  const candidate = (container.format === "nova-backup" ? container.data : container) as Partial<NovaData> | undefined;
  if (!candidate || !Array.isArray(candidate.projects) || !Array.isArray(candidate.tasks) || !Array.isArray(candidate.sessions)) throw new Error("У файлі відсутні проєкти, задачі або сесії");
  const events = Array.isArray(candidate.events) ? candidate.events : [];
  const total = candidate.projects.length + candidate.tasks.length + candidate.sessions.length + events.length;
  if (total > 900) throw new Error("Копія містить понад 900 записів — розділи її на менші файли");
  if (![candidate.projects, candidate.tasks, candidate.sessions, events].every(uniqueIds)) throw new Error("Копія містить дублікати записів");
  const projectIds = new Set(candidate.projects.map((item) => item.id));
  if (candidate.projects.some((item) => !idPattern.test(item.id) || !item.name?.trim() || item.name.length > 80 || !colorPattern.test(item.color) || !validTimestamp(item.createdAt))) throw new Error("Один із проєктів пошкоджений");
  if (candidate.tasks.some((item) => !idPattern.test(item.id) || !projectIds.has(item.projectId) || !item.text?.trim() || item.text.length > 240 || !validTimestamp(item.createdAt) || (item.status && !statuses.has(item.status)))) throw new Error("Одна із задач пошкоджена або не має проєкту");
  if (candidate.sessions.some((item) => !idPattern.test(item.id) || !projectIds.has(item.projectId) || !validTimestamp(item.startedAt) || !Number.isFinite(item.durationSeconds) || item.durationSeconds < 1 || item.durationSeconds > 43_200)) throw new Error("Одна з фокус-сесій пошкоджена");
  if (events.some((item) => !idPattern.test(item.id) || (item.projectId && !projectIds.has(item.projectId)) || !item.title?.trim() || !validTimestamp(item.startsAt) || item.durationMinutes < 1 || item.durationMinutes > 1_440)) throw new Error("Одна з календарних подій пошкоджена");
  const preferences = { focusMinutes: 25, breakMinutes: 5, autoPomodoro: false, dailyGoalMinutes: 120, activeProjectId: null, timerMode: "focus" as const, ...(candidate.preferences ?? {}) };
  return { projects: candidate.projects, tasks: candidate.tasks, sessions: candidate.sessions, events, preferences };
}

function mergeRecords<T extends { id: string; updatedAt?: number; createdAt?: number; startedAt?: number }>(current: T[], imported: T[]) {
  const result = new Map(current.map((item) => [item.id, item]));
  imported.forEach((item) => {
    const previous = result.get(item.id);
    const itemTime = item.updatedAt ?? item.createdAt ?? item.startedAt ?? 0;
    const previousTime = previous?.updatedAt ?? previous?.createdAt ?? previous?.startedAt ?? -1;
    if (!previous || itemTime >= previousTime) result.set(item.id, item);
  });
  return [...result.values()];
}

export function BackupManager({ data, save, syncing }: { data: NovaData; save: (next: NovaData) => Promise<void>; syncing: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [mode, setMode] = useState<Mode>("merge");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const exportData = () => {
    const payload = { format: "nova-backup", version: 1, exportedAt: Date.now(), data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `nova-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage("Резервну копію створено");
  };

  const chooseFile = async (file?: File) => {
    setError("");
    setMessage("");
    setPreview(null);
    if (!file) return;
    if (file.size > 2_000_000) return setError("Максимальний розмір копії — 2 МБ");
    try {
      const parsed = parseBackup(JSON.parse(await file.text()));
      setPreview({ data: parsed, name: file.name, size: file.size });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не вдалося прочитати файл");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const restore = async () => {
    if (!preview || syncing) return;
    if (mode === "replace" && !window.confirm("Замінити поточні дані в NOVA вмістом резервної копії?")) return;
    const imported = preview.data;
    const next = mode === "replace" ? imported : {
      projects: mergeRecords(data.projects, imported.projects),
      tasks: mergeRecords(data.tasks, imported.tasks),
      sessions: mergeRecords(data.sessions, imported.sessions),
      events: mergeRecords(data.events, imported.events),
      preferences: { ...data.preferences, ...imported.preferences },
    };
    const total = next.projects.length + next.tasks.length + next.sessions.length + next.events.length;
    if (total > 900) return setError("Після об’єднання буде понад 900 записів. Використай режим заміни або очисти старі дані.");
    await save(next);
    setPreview(null);
    setMessage(mode === "replace" ? "Дані відновлено й синхронізовано" : "Дані об’єднано й синхронізовано");
  };

  return (
    <div className="backup-manager">
      <div className="backup-buttons">
        <button type="button" onClick={exportData}>Експорт JSON ↓</button>
        <button type="button" className="backup-import" onClick={() => inputRef.current?.click()}>Імпорт копії ↑</button>
        <input ref={inputRef} type="file" accept="application/json,.json" onChange={(event) => void chooseFile(event.target.files?.[0])} aria-label="Вибрати резервну копію NOVA" />
      </div>

      {preview ? <div className="backup-preview">
        <div><i>✓</i><span><strong>{preview.name}</strong><small>{Math.max(1, Math.round(preview.size / 1024))} КБ · {preview.data.projects.length} проєктів · {preview.data.tasks.length} задач · {preview.data.sessions.length} сесій</small></span></div>
        <fieldset><legend>Спосіб відновлення</legend><label className={mode === "merge" ? "active" : ""}><input type="radio" name="restore-mode" checked={mode === "merge"} onChange={() => setMode("merge")} /><span>Об’єднати<small>Зберегти новіші записи</small></span></label><label className={mode === "replace" ? "active" : ""}><input type="radio" name="restore-mode" checked={mode === "replace"} onChange={() => setMode("replace")} /><span>Замінити<small>Відновити точну копію</small></span></label></fieldset>
        <div className="backup-preview-actions"><button type="button" onClick={() => setPreview(null)}>Скасувати</button><button type="button" onClick={() => void restore()} disabled={syncing}>{syncing ? "Синхронізую…" : "Відновити →"}</button></div>
      </div> : null}
      {error ? <p className="backup-message error" role="alert">{error}</p> : null}
      {message ? <p className="backup-message success" role="status">{message}</p> : null}
    </div>
  );
}
