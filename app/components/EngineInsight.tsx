"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Session = { id: string; projectId: string; startedAt: number; durationSeconds: number };
type Project = { id: string; name: string; color: string };
type Insight = {
  mode: "docker" | "embedded";
  focusScore: number;
  bestHour: number | null;
  activeDays: number;
  recommendation: string;
};

export function EngineInsight({ sessions, projects, periodDays }: { sessions: Session[]; projects: Project[]; periodDays: number }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const loadInsight = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch("/api/engine/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions, projects, periodDays, timezoneOffsetMinutes: new Date().getTimezoneOffset() }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Analytics request failed");
      const payload = await response.json();
      setInsight(payload.data as Insight);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailed(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [periodDays, projects, sessions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadInsight(), 180);
    return () => {
      window.clearTimeout(timeout);
      requestRef.current?.abort();
    };
  }, [loadInsight]);

  if (!insight && loading) {
    return <section className="engine-insight engine-insight-loading" aria-live="polite"><i /><div><span>NOVA intelligence</span><strong>Аналізую твій ритм…</strong></div></section>;
  }
  if (!insight && failed) {
    return <section className="engine-insight engine-insight-error" role="status"><div><span className="eyebrow">Аналітика тимчасово недоступна</span><h2>Дані збережені. Спробуй оновити розрахунок.</h2></div><button type="button" onClick={() => void loadInsight()}>Повторити</button></section>;
  }
  if (!insight) return null;

  return (
    <section className={`engine-insight${loading ? " is-refreshing" : ""}`} aria-live="polite">
      <div className="engine-insight-score"><span>Focus score</span><strong>{insight.focusScore}</strong><small>/100</small></div>
      <div><span className="eyebrow">{insight.mode === "docker" ? "Python intelligence" : "NOVA intelligence"}</span><h2>{insight.recommendation}</h2></div>
      <dl>
        <div><dt>Найкращий час</dt><dd>{insight.bestHour === null ? "—" : `${String(insight.bestHour).padStart(2, "0")}:00`}</dd></div>
        <div><dt>Активні дні</dt><dd>{insight.activeDays}</dd></div>
      </dl>
      <button type="button" className="engine-insight-refresh" onClick={() => void loadInsight()} disabled={loading} aria-label="Оновити персональну аналітику">↻</button>
    </section>
  );
}
