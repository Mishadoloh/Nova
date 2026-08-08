"use client";

import { useCallback, useEffect, useState } from "react";

export type Project = { id: string; name: string; color: string; createdAt: number };
export type Task = { id: string; projectId: string; text: string; done: boolean; createdAt: number };
export type Session = { id: string; projectId: string; startedAt: number; durationSeconds: number };
export type Preferences = { focusMinutes: number; breakMinutes: number; autoPomodoro: boolean };
export type NovaData = { projects: Project[]; tasks: Task[]; sessions: Session[]; preferences: Preferences };
export type Account = { displayName: string; email: string };

const emptyData: NovaData = { projects: [], tasks: [], sessions: [], preferences: { focusMinutes: 25, breakMinutes: 5, autoPomodoro: false } };

export function useNovaStore() {
  const [data, setData] = useState<NovaData>(emptyData);
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem("nova-v2-cache");
    if (cached) {
      try { setData(JSON.parse(cached)); } catch { /* optional cache */ }
    }
    fetch("/api/sync").then(async (response) => {
      if (!response.ok) throw new Error("offline");
      const result = await response.json();
      setAccount(result.user);
      setData((current) => ({
        projects: result.projects?.length ? result.projects : current.projects,
        tasks: result.tasks?.length ? result.tasks : current.tasks,
        sessions: result.sessions?.length ? result.sessions : current.sessions,
        preferences: result.preferences ?? current.preferences,
      }));
    }).catch(() => undefined).finally(() => setReady(true));
  }, []);

  const save = useCallback(async (next: NovaData) => {
    setData(next);
    localStorage.setItem("nova-v2-cache", JSON.stringify(next));
    setSyncing(true);
    try { await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }); } finally { setSyncing(false); }
  }, []);

  return { data, account, ready, syncing, save };
}
