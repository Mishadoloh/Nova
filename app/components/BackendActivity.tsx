"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../lib/supabase";

type Activity = {
  id: string;
  action: string;
  entityType: string;
  label: string;
  createdAt: number;
  metadata: Record<string, unknown> | null;
};

const icons: Record<string, string> = {
  workspace: "↻",
  project: "◫",
  task: "✓",
  session: "◷",
};

export function BackendActivity() {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await authFetch("/api/activity?limit=8", { cache: "no-store" });
      if (!response.ok) throw new Error("activity");
      const result = await response.json();
      setItems(result.data?.items ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  const clear = async () => {
    if (!window.confirm("Очистити журнал активності? Дані проєктів і сесій залишаться.")) return;
    const response = await authFetch("/api/activity", { method: "DELETE" });
    if (response.ok) setItems([]);
  };

  return (
    <section className="backend-activity" aria-live="polite">
      <header>
        <div><span className="eyebrow">Backend activity</span><h2>Журнал змін</h2></div>
        <div className="backend-activity-actions">
          <button type="button" onClick={() => void load()} disabled={loading}>Оновити</button>
          {items.length ? <button type="button" onClick={() => void clear()}>Очистити</button> : null}
        </div>
      </header>

      {loading && !items.length ? <div className="activity-loading"><i /><span>Завантажую захищений журнал…</span></div> : null}
      {error && !items.length ? <div className="activity-empty"><b>Немає звʼязку</b><span>Журнал стане доступним після відновлення мережі.</span></div> : null}
      {!loading && !error && !items.length ? <div className="activity-empty"><b>Журнал чистий</b><span>Нові синхронізації та дії зʼявляться тут.</span></div> : null}

      {items.length ? <ol>{items.map((item) => (
        <li key={item.id}>
          <i>{icons[item.entityType] ?? "·"}</i>
          <div><strong>{item.label}</strong><small>{new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(item.createdAt)}</small></div>
          <span>{item.action}</span>
        </li>
      ))}</ol> : null}
    </section>
  );
}
