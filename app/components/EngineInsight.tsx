"use client";

import { useEffect, useState } from "react";

type Session = {
  id: string;
  projectId: string;
  startedAt: number;
  durationSeconds: number;
};
type Project = { id: string; name: string; color: string };
type Insight = {
  mode: "docker" | "embedded";
  focusScore: number;
  bestHour: number | null;
  activeDays: number;
  recommendation: string;
};

export function EngineInsight({
  sessions,
  projects,
  periodDays,
}: {
  sessions: Session[];
  projects: Project[];
  periodDays: number;
}) {
  const [insight, setInsight] = useState<Insight | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch("/api/engine/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessions,
          projects,
          periodDays,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        }),
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((payload) => setInsight(payload.data as Insight))
        .catch(() => undefined);
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [sessions, projects, periodDays]);

  if (!insight) return null;
  return (
    <section className="engine-insight" aria-live="polite">
      <div className="engine-insight-score">
        <span>Focus score</span>
        <strong>{insight.focusScore}</strong>
        <small>/100</small>
      </div>
      <div>
        <span className="eyebrow">
          {insight.mode === "docker"
            ? "Python intelligence"
            : "NOVA intelligence"}
        </span>
        <h2>{insight.recommendation}</h2>
      </div>
      <dl>
        <div>
          <dt>Найкращий час</dt>
          <dd>
            {insight.bestHour === null
              ? "—"
              : `${String(insight.bestHour).padStart(2, "0")}:00`}
          </dd>
        </div>
        <div>
          <dt>Активні дні</dt>
          <dd>{insight.activeDays}</dd>
        </div>
      </dl>
    </section>
  );
}
