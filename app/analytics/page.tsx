"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame, PageTitle } from "../components/AppFrame";
import { EngineInsight } from "../components/EngineInsight";
import { useNovaStore } from "../components/nova-store";

function AnimatedValue({
  value,
  format = (item) => String(item),
}: {
  value: number;
  format?: (item: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame = 0;
    const started = performance.now(),
      duration = 850;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / duration),
        eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{format(display)}</>;
}

type ChartDay = {
  label: number;
  minutes: number;
  date: number;
  sessions: number;
};
type HeatDay = { date: number; sessions: number; minutes: number };

function InteractiveFocusChart({
  chart,
  max,
}: {
  chart: ChartDay[];
  max: number;
}) {
  const initial = Math.max(
    0,
    chart.reduce(
      (best, item, index) =>
        item.minutes >= chart[best].minutes ? index : best,
      0,
    ),
  );
  const [pinned, setPinned] = useState(initial);
  const [hovered, setHovered] = useState<number | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = hovered ?? pinned,
    active = chart[activeIndex] ?? chart[0];
  const select = (index: number) => {
    const next = (index + chart.length) % chart.length;
    setPinned(next);
    buttons.current[next]?.focus();
  };
  const dateLabel = active
    ? new Intl.DateTimeFormat("uk-UA", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(active.date)
    : "";
  return (
    <>
      <div
        className="fourteen-chart"
        role="group"
        aria-label="Інтерактивний графік хвилин у фокусі"
        onMouseLeave={() => setHovered(null)}
      >
        {chart.map((day, index) => {
          const height = Math.max(3, (day.minutes / max) * 100);
          return (
            <div
              className={activeIndex === index ? "active" : ""}
              key={day.date}
            >
              <button
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                className="chart-day"
                type="button"
                aria-pressed={pinned === index}
                aria-label={`${new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(day.date)}: ${day.minutes} хвилин, ${day.sessions} сесій`}
                style={{ "--bar-height": `${height}%` } as React.CSSProperties}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                onClick={() => setPinned(index)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    select(index + (event.key === "ArrowRight" ? 1 : -1));
                  }
                }}
              >
                <span>{day.minutes || ""}</span>
                <i style={{ height: `${height}%` }} />
                <small>{day.label}</small>
                <span className="chart-tooltip" aria-hidden="true">
                  <b>{day.minutes} хв</b>
                  <em>
                    {day.sessions} {day.sessions === 1 ? "сесія" : "сесій"}
                  </em>
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {active && (
        <div className="chart-inspector" aria-live="polite">
          <div>
            <span className="eyebrow">Обраний день</span>
            <strong>{dateLabel}</strong>
          </div>
          <div>
            <b>{active.minutes} хв</b>
            <span>
              {active.sessions} {active.sessions === 1 ? "сесія" : "сесій"}
            </span>
          </div>
          <small>Наведи, натисни або використовуй ← →</small>
        </div>
      )}
    </>
  );
}

function InteractiveHeatMap({ items }: { items: HeatDay[] }) {
  const initial = Math.max(
    0,
    items.reduce(
      (best, item, index) =>
        item.sessions >= items[best].sessions ? index : best,
      0,
    ),
  );
  const [pinned, setPinned] = useState(initial);
  const [hovered, setHovered] = useState<number | null>(null);
  const activeIndex = hovered ?? pinned,
    active = items[activeIndex] ?? items[0];
  return (
    <>
      <div
        className="heat-grid"
        role="group"
        aria-label="Активність за останні п’ять тижнів"
        onMouseLeave={() => setHovered(null)}
      >
        {items.map((item, index) => (
          <button
            type="button"
            className={`heat-cell ${item.sessions > 1 ? "hot" : item.sessions ? "warm" : ""} ${activeIndex === index ? "active" : ""}`}
            key={item.date}
            aria-pressed={pinned === index}
            aria-label={`${new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(item.date)}: ${item.sessions} сесій, ${item.minutes} хвилин`}
            onMouseEnter={() => setHovered(index)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
            onClick={() => setPinned(index)}
          >
            <span>
              <b>{item.minutes} хв</b>
              <small>
                {item.sessions} {item.sessions === 1 ? "сесія" : "сесій"}
              </small>
            </span>
          </button>
        ))}
      </div>
      <div className="heat-labels">
        <span>5 тижнів тому</span>
        <span>Сьогодні</span>
      </div>
      {active && (
        <div className="heat-inspector" aria-live="polite">
          <div>
            <span className="eyebrow">Обраний день</span>
            <strong>
              {new Intl.DateTimeFormat("uk-UA", {
                weekday: "short",
                day: "numeric",
                month: "long",
              }).format(active.date)}
            </strong>
          </div>
          <div>
            <b>{active.minutes} хв</b>
            <small>
              {active.sessions} {active.sessions === 1 ? "сесія" : "сесій"}
            </small>
          </div>
        </div>
      )}
    </>
  );
}

export default function AnalyticsPage() {
  const { data } = useNovaStore();
  const [days, setDays] = useState(14);
  const [projectId, setProjectId] = useState("all");
  const now = Date.now(),
    start = now - days * 86400000,
    previousStart = start - days * 86400000;
  const periodSessions = useMemo(
    () => data.sessions.filter((item) => item.startedAt >= start),
    [data.sessions, start],
  );
  const sessions = useMemo(
    () =>
      periodSessions.filter(
        (item) => projectId === "all" || item.projectId === projectId,
      ),
    [periodSessions, projectId],
  );
  const previous = data.sessions.filter(
    (item) =>
      item.startedAt >= previousStart &&
      item.startedAt < start &&
      (projectId === "all" || item.projectId === projectId),
  );
  const total = Math.round(
      sessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60,
    ),
    previousTotal = Math.round(
      previous.reduce((sum, item) => sum + item.durationSeconds, 0) / 60,
    ),
    change = previousTotal
      ? Math.round(((total - previousTotal) / previousTotal) * 100)
      : total
        ? 100
        : 0;
  const chart = Array.from({ length: days }, (_, offset) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (days - 1 - offset));
    const end = day.getTime() + 86400000,
      daySessions = sessions.filter(
        (item) => item.startedAt >= day.getTime() && item.startedAt < end,
      );
    return {
      label: day.getDate(),
      date: day.getTime(),
      sessions: daySessions.length,
      minutes: Math.round(
        daySessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60,
      ),
    };
  });
  const max = Math.max(60, ...chart.map((item) => item.minutes));
  const longest = Math.round(
    Math.max(0, ...sessions.map((item) => item.durationSeconds)) / 60,
  );
  const early = sessions.filter(
    (item) => new Date(item.startedAt).getHours() < 10,
  ).length;
  const bestDay = chart.reduce(
    (best, item) => (item.minutes > best.minutes ? item : best),
    { label: 0, minutes: 0, date: 0, sessions: 0 },
  );
  const distributionTotal = Math.round(
    periodSessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60,
  );
  const heatDays = Array.from({ length: 35 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (34 - index));
    const end = day.getTime() + 86400000,
      daySessions = data.sessions.filter(
        (item) =>
          item.startedAt >= day.getTime() &&
          item.startedAt < end &&
          (projectId === "all" || item.projectId === projectId),
      );
    return {
      date: day.getTime(),
      sessions: daySessions.length,
      minutes: Math.round(
        daySessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60,
      ),
    };
  });
  const exportCsv = () => {
    const rows = [
      "date,project,duration_minutes",
      ...sessions.map(
        (item) =>
          `${new Date(item.startedAt).toISOString()},${data.projects.find((project) => project.id === item.projectId)?.name ?? "Focus"},${Math.round(item.durationSeconds / 60)}`,
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nova-analytics.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <AppFrame active="analytics">
      <PageTitle
        eyebrow="Тільки реальні дані"
        title="Аналітика фокусу"
        description="Фільтруй власні сесії, порівнюй періоди та знаходь персональні рекорди."
        action={
          <div className="analytics-filters">
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              <option value="7">7 днів</option>
              <option value="14">14 днів</option>
              <option value="30">30 днів</option>
              <option value="90">90 днів</option>
            </select>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="all">Усі проєкти</option>
              {data.projects.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button onClick={exportCsv}>CSV ↓</button>
            <button onClick={() => window.print()}>PDF ↓</button>
          </div>
        }
      />
      <section
        className="metric-row"
        key={`metrics-${days}-${projectId}-${total}`}
      >
        <div>
          <span>Фокус за період</span>
          <strong>
            <AnimatedValue
              value={total}
              format={(value) => `${Math.floor(value / 60)}г ${value % 60}хв`}
            />
          </strong>
          <small className={change >= 0 ? "positive" : "negative"}>
            {change >= 0 ? "↑" : "↓"} {Math.abs(change)}% проти попереднього
          </small>
        </div>
        <div>
          <span>Середня сесія</span>
          <strong>
            <AnimatedValue
              value={sessions.length ? Math.round(total / sessions.length) : 0}
              format={(value) => `${value} хв`}
            />
          </strong>
          <small>{sessions.length} реальних сесій</small>
        </div>
        <div>
          <span>Найдовша сесія</span>
          <strong>
            <AnimatedValue value={longest} format={(value) => `${value} хв`} />
          </strong>
          <small>Персональний рекорд</small>
        </div>
        <div>
          <span>Ранній фокус</span>
          <strong>
            <AnimatedValue value={early} />
          </strong>
          <small>сесій до 10:00</small>
        </div>
      </section>
      <section className="analytics-main">
        <div className="big-chart">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Динаміка</span>
              <h2>Хвилини у фокусі</h2>
            </div>
            <span className="trend">
              {change >= 0 ? "+" : ""}
              {change}%
            </span>
          </div>
          <InteractiveFocusChart
            key={`chart-${days}-${projectId}-${total}`}
            chart={chart}
            max={max}
          />
        </div>
        <div className="focus-score">
          <span className="eyebrow">Рекорд періоду</span>
          <div
            className="score-ring"
            key={`ring-${days}-${projectId}-${bestDay.minutes}`}
            aria-label={`Рекорд: ${bestDay.minutes} хвилин`}
            style={
              {
                "--score-target": `${Math.min(360, (bestDay.minutes / Math.max(90, bestDay.minutes)) * 360)}deg`,
              } as React.CSSProperties
            }
          >
            <div className="score-ring-value">
              <strong>
                <AnimatedValue value={bestDay.minutes} />
              </strong>
              <small>хв</small>
            </div>
          </div>
          <h2>
            {bestDay.minutes ? `${bestDay.label}-го числа` : "Ще попереду"}
          </h2>
          <p>
            {bestDay.minutes
              ? "Найсильніший день у вибраному періоді."
              : "Заверши першу сесію, щоб побачити рекорди."}
          </p>
        </div>
      </section>
      <EngineInsight
        sessions={sessions}
        projects={data.projects}
        periodDays={days}
      />
      <section className="analytics-lower">
        <div className="category-panel">
          <span className="eyebrow">Розподіл</span>
          <h2>Увага за проєктами</h2>
          {data.projects.map((project) => {
            const minutes = Math.round(
                periodSessions
                  .filter((item) => item.projectId === project.id)
                  .reduce((sum, item) => sum + item.durationSeconds, 0) / 60,
              ),
              percent = distributionTotal
                ? (minutes / distributionTotal) * 100
                : 0;
            return (
              <button
                type="button"
                className={`category-row ${projectId === project.id ? "active" : ""}`}
                aria-pressed={projectId === project.id}
                onClick={() =>
                  setProjectId(projectId === project.id ? "all" : project.id)
                }
                key={`${project.id}-${days}`}
              >
                <i style={{ background: project.color }} />
                <span>
                  {project.name}
                  <small>{Math.round(percent)}%</small>
                </span>
                <div>
                  <b
                    style={{ width: `${percent}%`, background: project.color }}
                  />
                </div>
                <strong>{minutes} хв</strong>
              </button>
            );
          })}
        </div>
        <div className="heat-panel">
          <span className="eyebrow">Активність</span>
          <h2>Теплова карта</h2>
          <InteractiveHeatMap
            key={`heat-${projectId}-${data.sessions.length}`}
            items={heatDays}
          />
        </div>
      </section>
    </AppFrame>
  );
}
