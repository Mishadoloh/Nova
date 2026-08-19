"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AudioMixer } from "./components/AudioMixer";
import { EngineStatus } from "./components/EngineStatus";

type Project = { id: string; name: string; color: string; createdAt: number };
type Task = {
  id: string;
  projectId: string;
  text: string;
  done: boolean;
  createdAt: number;
};
type Session = {
  id: string;
  projectId: string;
  startedAt: number;
  durationSeconds: number;
};
type Preferences = {
  focusMinutes: number;
  breakMinutes: number;
  autoPomodoro: boolean;
  dailyGoalMinutes: number;
  activeProjectId: string | null;
  timerMode: "focus" | "break";
};
type Account = { displayName: string; email: string };

const defaultProjects: Project[] = [];
const defaultTasks: Task[] = [];
const defaultSessions: Session[] = [];
const defaultPreferences: Preferences = {
  focusMinutes: 25,
  breakMinutes: 5,
  autoPomodoro: false,
  dailyGoalMinutes: 120,
  activeProjectId: null,
  timerMode: "focus",
};
const colors = ["#dfff00", "#78d6ff", "#ff7a5c", "#c7a7ff", "#ffd66b"];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type WeekPoint = {
  label: string;
  minutes: number;
  date: number;
  sessions: number;
};
type HourPoint = { hour: number; minutes: number; sessions: number };

function InteractiveWeek({ items, max }: { items: WeekPoint[]; max: number }) {
  const initial = items.reduce(
    (best, item, index) => (item.minutes >= items[best].minutes ? index : best),
    0,
  );
  const [pinned, setPinned] = useState(initial);
  const [hovered, setHovered] = useState<number | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = hovered ?? pinned,
    active = items[activeIndex];
  const select = (index: number) => {
    const next = (index + items.length) % items.length;
    setPinned(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="week-chart">
      <div className="week-inspector" aria-live="polite">
        <div>
          <span className="eyebrow">Обраний день</span>
          <strong>
            {new Intl.DateTimeFormat("uk-UA", {
              weekday: "long",
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
      <div
        className="chart-grid"
        role="group"
        aria-label="Фокус за останні сім днів"
        onMouseLeave={() => setHovered(null)}
      >
        {items.map((day, index) => (
          <button
            type="button"
            ref={(node) => {
              refs.current[index] = node;
            }}
            className={`chart-column ${activeIndex === index ? "active" : ""}`}
            key={day.date}
            aria-pressed={pinned === index}
            aria-label={`${day.minutes} хвилин, ${day.sessions} сесій`}
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
            <span>{day.minutes ? `${day.minutes} хв` : ""}</span>
            <i
              style={{ height: `${Math.max(4, (day.minutes / max) * 100)}%` }}
            />
            <small>{day.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function InteractiveBestTime({ hours }: { hours: HourPoint[] }) {
  const buckets = [0, 3, 6, 9, 12, 15, 18, 21].map((hour) => {
    const points = hours.filter(
      (item) => item.hour >= hour && item.hour < hour + 3,
    );
    return {
      hour,
      minutes: Math.round(points.reduce((sum, item) => sum + item.minutes, 0)),
      sessions: points.reduce((sum, item) => sum + item.sessions, 0),
    };
  });
  const initial = buckets.reduce(
    (best, item, index) =>
      item.minutes >= buckets[best].minutes ? index : best,
    0,
  );
  const [pinned, setPinned] = useState(initial);
  const [hovered, setHovered] = useState<number | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = hovered ?? pinned,
    active = buckets[activeIndex];
  const select = (index: number) => {
    const next = (index + buckets.length) % buckets.length;
    setPinned(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="best-time">
      <span className="eyebrow">Найсильніша година</span>
      <strong>{String(active.hour).padStart(2, "0")}:00</strong>
      <p>
        {active.minutes
          ? `${active.minutes} хв фокусу · ${active.sessions} ${active.sessions === 1 ? "сесія" : "сесій"} у цьому часовому вікні.`
          : "У цьому часовому вікні ще немає завершених сесій."}
      </p>
      <div
        className="hour-line"
        role="group"
        aria-label="Фокус за часом доби"
        onMouseLeave={() => setHovered(null)}
      >
        {buckets.map((bucket, index) => (
          <button
            type="button"
            ref={(node) => {
              refs.current[index] = node;
            }}
            className={`hour-point ${activeIndex === index ? "active" : ""} ${bucket.minutes ? "has-data" : ""}`}
            key={bucket.hour}
            aria-pressed={pinned === index}
            aria-label={`${bucket.hour}:00, ${bucket.minutes} хвилин`}
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
            <i
              style={
                {
                  "--intensity": `${Math.max(0.08, bucket.minutes / Math.max(1, ...buckets.map((item) => item.minutes)))}`,
                } as React.CSSProperties
              }
            />
            <span>{bucket.hour}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  const [activeProject, setActiveProject] = useState("");
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const [sessions, setSessions] = useState<Session[]>(defaultSessions);
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  const [account, setAccount] = useState<Account | null>(null);
  const [syncState, setSyncState] = useState<"offline" | "syncing" | "synced">(
    "offline",
  );
  const [timerMode, setTimerMode] = useState<"focus" | "break">(
    defaultPreferences.timerMode,
  );
  const [seconds, setSeconds] = useState(defaultPreferences.focusMinutes * 60);
  const [running, setRunning] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newProject, setNewProject] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [zen, setZen] = useState(false);
  const [sound, setSound] = useState("Тиша");
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [volume, setVolume] = useState(38);
  const [quote, setQuote] = useState(0);
  const [timerPlanId, setTimerPlanId] = useState("");
  const hydrated = useRef(false);
  const serverReady = useRef(false);
  const completionHandled = useRef(false);
  const audioRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    source: AudioBufferSourceNode;
    interval?: number;
  } | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem("nova-v2-cache");
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.projects?.length) setProjects(data.projects);
        if (data.tasks) setTasks(data.tasks);
        if (data.sessions) setSessions(data.sessions);
        if (data.preferences) {
          const next = {
            ...defaultPreferences,
            ...data.preferences,
          } as Preferences;
          setPreferences(next);
          setTimerMode(next.timerMode);
          setActiveProject(next.activeProjectId ?? "");
          setSeconds(
            (next.timerMode === "focus"
              ? next.focusMinutes
              : next.breakMinutes) * 60,
          );
        }
      } catch {
        /* offline cache is optional */
      }
    }

    fetch("/api/sync")
      .then(async (response) => {
        if (!response.ok) throw new Error("offline");
        const data = await response.json();
        setAccount(data.user);
        if (data.projects?.length) setProjects(data.projects);
        if (data.tasks?.length) setTasks(data.tasks);
        if (data.sessions?.length) setSessions(data.sessions);
        if (data.preferences) {
          const next = {
            ...defaultPreferences,
            ...data.preferences,
          } as Preferences;
          setPreferences(next);
          setTimerMode(next.timerMode);
          setActiveProject(next.activeProjectId ?? "");
          setSeconds(
            (next.timerMode === "focus"
              ? next.focusMinutes
              : next.breakMinutes) * 60,
          );
        }
        setSyncState("synced");
        serverReady.current = true;
      })
      .catch(() => setSyncState("offline"))
      .finally(() => {
        hydrated.current = true;
      });
  }, []);

  useEffect(() => {
    if (!projects.length) return;
    const preferred = projects.some(
        (item) => item.id === preferences.activeProjectId,
      )
        ? preferences.activeProjectId
        : null,
      next =
        preferred ??
        (projects.some((item) => item.id === activeProject)
          ? activeProject
          : projects[0].id);
    if (next !== activeProject) setActiveProject(next);
    if (next !== preferences.activeProjectId)
      setPreferences((value) => ({ ...value, activeProjectId: next }));
  }, [projects, activeProject, preferences.activeProjectId]);

  useEffect(() => {
    if (!hydrated.current) return;
    let events: unknown[] = [];
    try {
      events =
        JSON.parse(localStorage.getItem("nova-v3-cache") ?? "{}").events ?? [];
    } catch {
      /* keep an empty event cache */
    }
    const snapshot = { projects, tasks, sessions, events, preferences };
    localStorage.setItem("nova-v2-cache", JSON.stringify(snapshot));
    localStorage.setItem("nova-v3-cache", JSON.stringify(snapshot));
    window.dispatchEvent(
      new CustomEvent("nova-store-updated", { detail: snapshot }),
    );
    if (!serverReady.current || !account) return;
    setSyncState("syncing");
    const timeout = window.setTimeout(() => {
      fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects, tasks, sessions, preferences }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("sync");
          setSyncState("synced");
        })
        .catch(() => setSyncState("offline"));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [projects, tasks, sessions, preferences, account]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (seconds !== 0 || !running || completionHandled.current) return;
    completionHandled.current = true;
    setRunning(false);
    if (timerMode === "focus") {
      setSessions((items) => [
        {
          id: uid("session"),
          projectId: activeProject,
          startedAt: Date.now() - preferences.focusMinutes * 60000,
          durationSeconds: preferences.focusMinutes * 60,
        },
        ...items,
      ]);
    }
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(
        timerMode === "focus" ? "Фокус завершено ✦" : "Перерва завершена",
        {
          body:
            timerMode === "focus"
              ? "Час видихнути й відновитися."
              : "Готовий до нового ривка?",
        },
      );
    }
    if (preferences.autoPomodoro) {
      const nextMode = timerMode === "focus" ? "break" : "focus";
      setTimerMode(nextMode);
      setPreferences((value) => ({ ...value, timerMode: nextMode }));
      setSeconds(
        (nextMode === "focus"
          ? preferences.focusMinutes
          : preferences.breakMinutes) * 60,
      );
      window.setTimeout(() => {
        completionHandled.current = false;
        setRunning(true);
      }, 900);
    }
  }, [seconds, running, timerMode, activeProject, preferences]);

  useEffect(() => {
    if (!running)
      setSeconds(
        (timerMode === "focus"
          ? preferences.focusMinutes
          : preferences.breakMinutes) * 60,
      );
  }, [preferences.focusMinutes, preferences.breakMinutes, timerMode, running]);

  useEffect(() => {
    if (audioRef.current)
      audioRef.current.gain.gain.value = (volume / 100) * 0.28;
  }, [volume]);

  useEffect(() => () => stopAmbient(), []);

  const stopAmbient = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.interval) window.clearInterval(audio.interval);
    try {
      audio.source.stop();
      audio.ctx.close();
    } catch {
      /* already closed */
    }
    audioRef.current = null;
    setSoundPlaying(false);
  };

  const playAmbient = (name: string) => {
    stopAmbient();
    setSound(name);
    if (name === "Тиша") return;
    const ctx = new AudioContext();
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      channel[i] = name === "Дощ" ? white * 0.52 : brown * 3.2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = name === "Дощ" ? "highpass" : "lowpass";
    filter.frequency.value =
      name === "Дощ" ? 900 : name === "Кавʼярня" ? 520 : 1200;
    const gain = ctx.createGain();
    gain.gain.value = (volume / 100) * 0.28;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    const ambient = { ctx, gain, source } as {
      ctx: AudioContext;
      gain: GainNode;
      source: AudioBufferSourceNode;
      interval?: number;
    };
    if (name === "Ліс") {
      ambient.interval = window.setInterval(() => {
        const oscillator = ctx.createOscillator();
        const birdGain = ctx.createGain();
        oscillator.frequency.setValueAtTime(
          1550 + Math.random() * 900,
          ctx.currentTime,
        );
        oscillator.frequency.exponentialRampToValueAtTime(
          2400,
          ctx.currentTime + 0.12,
        );
        birdGain.gain.setValueAtTime(0, ctx.currentTime);
        birdGain.gain.linearRampToValueAtTime(
          (volume / 100) * 0.06,
          ctx.currentTime + 0.02,
        );
        birdGain.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + 0.25,
        );
        oscillator.connect(birdGain).connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.26);
      }, 4200);
    }
    audioRef.current = ambient;
    setSoundPlaying(true);
  };

  const resetTimer = (mode = timerMode) => {
    setRunning(false);
    setTimerMode(mode);
    setPreferences((value) => ({ ...value, timerMode: mode }));
    setSeconds(
      (mode === "focus" ? preferences.focusMinutes : preferences.breakMinutes) *
        60,
    );
    completionHandled.current = false;
  };

  const prepareTimerPlan = () => {
    fetch("/api/engine/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        focusMinutes: preferences.focusMinutes,
        breakMinutes: preferences.breakMinutes,
        longBreakMinutes: Math.max(15, preferences.breakMinutes * 3),
        cycles: 4,
        autoStart: preferences.autoPomodoro,
      }),
    })
      .then((response) => response.json())
      .then((payload) => setTimerPlanId(String(payload.data?.planId ?? "")))
      .catch(() => undefined);
  };

  const toggleTimer = () => {
    if (seconds === 0) resetTimer();
    if (!running) prepareTimerPlan();
    completionHandled.current = false;
    setRunning((value) => !value);
  };

  const selectProject = (id: string) => {
    setActiveProject(id);
    setPreferences((value) => ({ ...value, activeProjectId: id }));
  };

  const addTask = (event: FormEvent) => {
    event.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    setTasks((items) => [
      ...items,
      {
        id: uid("task"),
        projectId: activeProject,
        text,
        done: false,
        createdAt: Date.now(),
      },
    ]);
    setNewTask("");
  };

  const addProject = (event: FormEvent) => {
    event.preventDefault();
    const name = newProject.trim();
    if (!name) return;
    const project = {
      id: uid("project"),
      name,
      color: colors[projects.length % colors.length],
      createdAt: Date.now(),
    };
    setProjects((items) => [...items, project]);
    selectProject(project.id);
    setNewProject("");
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
  };

  const project =
    projects.find((item) => item.id === activeProject) ?? projects[0];
  const visibleTasks = tasks.filter((task) => task.projectId === activeProject);
  const completed = tasks.filter((task) => task.done).length;
  const totalSeconds =
    (timerMode === "focus"
      ? preferences.focusMinutes
      : preferences.breakMinutes) * 60;
  const timerProgress = totalSeconds ? 1 - seconds / totalSeconds : 0;
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const date = useMemo(
    () =>
      new Intl.DateTimeFormat("uk-UA", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [],
  );
  const totalMinutes = Math.round(
    sessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60,
  );
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMinutes = Math.round(
    sessions
      .filter((session) => session.startedAt >= todayStart.getTime())
      .reduce((sum, session) => sum + session.durationSeconds, 0) / 60,
  );
  const goalProgress = Math.min(
    100,
    Math.round(
      (todayMinutes / Math.max(1, preferences.dailyGoalMinutes)) * 100,
    ),
  );
  const level = Math.floor(totalMinutes / 120) + 1;
  const activeDays = new Set(
    sessions.map((session) => new Date(session.startedAt).toDateString()),
  );
  let streak = 0;
  for (let index = 0; index < 365; index++) {
    const day = new Date();
    day.setDate(day.getDate() - index);
    if (activeDays.has(day.toDateString())) streak++;
    else if (index > 0) break;
  }
  const weekData = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - offset));
    const next = day.getTime() + 86400000;
    const daySessions = sessions.filter(
        (session) =>
          session.startedAt >= day.getTime() && session.startedAt < next,
      ),
      minutes = Math.round(
        daySessions.reduce((sum, session) => sum + session.durationSeconds, 0) /
          60,
      );
    return {
      label: new Intl.DateTimeFormat("uk-UA", { weekday: "short" })
        .format(day)
        .slice(0, 2),
      minutes,
      date: day.getTime(),
      sessions: daySessions.length,
    };
  });
  const maxWeek = Math.max(60, ...weekData.map((item) => item.minutes));
  const hourData = Array.from({ length: 24 }, (_, hour) => {
    const items = sessions.filter(
      (session) => new Date(session.startedAt).getHours() === hour,
    );
    return {
      hour,
      minutes: items.reduce(
        (sum, session) => sum + session.durationSeconds / 60,
        0,
      ),
      sessions: items.length,
    };
  });
  const achievements = [
    { name: "Перший крок", mark: "01", unlocked: sessions.length >= 1 },
    { name: "Глибока хвиля", mark: "02", unlocked: totalMinutes >= 120 },
    { name: "Майстер справ", mark: "03", unlocked: completed >= 5 },
    { name: "Серія 7", mark: "07", unlocked: streak >= 7 },
  ];
  const quotes = [
    "Те, на чому ти фокусуєшся, росте.",
    "Один чистий крок важить більше десяти планів.",
    "Захисти увагу — і день стане твоїм.",
  ];

  return (
    <main
      className={`app-shell ${zen ? "zen-mode" : ""}`}
      style={{ "--accent": project?.color ?? "#dfff00" } as React.CSSProperties}
    >
      <div className="noise" />
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="NOVA — на початок">
          <span>N</span>NOVA
        </a>
        <nav aria-label="Головна навігація">
          <a className="nav-item active" href="/">
            <i>01</i>Фокус
          </a>
          <a className="nav-item" href="/projects">
            <i>02</i>Проєкти
          </a>
          <a className="nav-item" href="/calendar">
            <i>03</i>Календар
          </a>
          <a className="nav-item" href="/analytics">
            <i>04</i>Аналітика
          </a>
          <a className="nav-item" href="/history">
            <i>05</i>Історія
          </a>
          <a className="nav-item" href="/achievements">
            <i>06</i>Нагороди
          </a>
          <a className="nav-item" href="/account">
            <i>07</i>Профіль
          </a>
        </nav>
        <div className="level-card">
          <span className="eyebrow">Рівень {level}</span>
          <strong>
            {totalMinutes}
            <small> хв фокусу</small>
          </strong>
          <div>
            <i style={{ width: `${(totalMinutes % 120) / 1.2}%` }} />
          </div>
        </div>
        <button className="profile" type="button">
          <span className="avatar">
            {account?.displayName?.[0]?.toUpperCase() ?? "N"}
          </span>
          <span>
            {account?.displayName?.split(" ")[0] ?? "Локальний профіль"}
            <small>
              {syncState === "synced"
                ? "✓ Синхронізовано"
                : syncState === "syncing"
                  ? "Синхронізація…"
                  : "Офлайн-режим"}
            </small>
          </span>
          <b>•••</b>
        </button>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <div>
            <span className="eyebrow">Сьогодні</span>
            <p>{date}</p>
          </div>
          <div className="top-actions">
            <button
              type="button"
              onClick={requestNotifications}
              aria-label="Увімкнути сповіщення"
            >
              ♢
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="Налаштування таймера"
            >
              ⚙
            </button>
            <button
              className="status"
              type="button"
              onClick={() => setZen(true)}
            >
              <i /> Без відволікань
            </button>
          </div>
        </header>

        <div className="hero-copy">
          <span className="kicker">ТВІЙ ЧАС. ТВОЇ ПРАВИЛА.</span>
          <h1>
            Злови <em>ритм.</em>
            <br />
            Зроби важливе.
          </h1>
          <p>
            Один простір для глибокої роботи — тепер із синхронізацією,
            аналітикою та власним ритмом.
          </p>
        </div>

        <section className="focus-grid" id="focus">
          <div className="timer-card">
            <div className="timer-head">
              <span className="eyebrow">
                {timerMode === "focus"
                  ? `Фокус · ${project?.name ?? "без проєкту"}`
                  : "Відновлення"}
              </span>
              {timerPlanId && (
                <small className="timer-engine-plan">
                  C++ · {timerPlanId.slice(-6)}
                </small>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => resetTimer()}
                  aria-label="Скинути таймер"
                >
                  ↻
                </button>
                {zen && (
                  <button
                    className="exit-zen"
                    type="button"
                    onClick={() => setZen(false)}
                  >
                    Вийти ×
                  </button>
                )}
              </div>
            </div>
            <div
              className="mode-tabs"
              role="tablist"
              aria-label="Режим таймера"
            >
              <button
                type="button"
                role="tab"
                aria-selected={timerMode === "focus"}
                className={timerMode === "focus" ? "selected" : ""}
                onClick={() => resetTimer("focus")}
              >
                Фокус · {preferences.focusMinutes} хв
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={timerMode === "break"}
                className={timerMode === "break" ? "selected" : ""}
                onClick={() => resetTimer("break")}
              >
                Перерва · {preferences.breakMinutes} хв
              </button>
            </div>
            <div className="timer-wrap">
              <div
                className="orbit"
                style={
                  {
                    "--progress": `${timerProgress * 360}deg`,
                  } as React.CSSProperties
                }
              >
                <div className="timer-core">
                  <span>
                    {timerMode === "focus"
                      ? "Глибокий фокус"
                      : "Час відновитись"}
                  </span>
                  <strong>{time}</strong>
                  <small>
                    {running
                      ? "Тримай темп"
                      : seconds === 0
                        ? "Сесію завершено"
                        : "Готовий почати?"}
                  </small>
                </div>
              </div>
            </div>
            <div className="timer-actions">
              <button
                className="start-button"
                type="button"
                onClick={toggleTimer}
              >
                <span>{running ? "Ⅱ" : "▶"}</span>
                {running ? "Пауза" : seconds === 0 ? "Ще одна сесія" : "Почати"}
              </button>
              {running && !zen && (
                <button
                  className="zen-button"
                  type="button"
                  onClick={() => setZen(true)}
                >
                  Режим блокування ↗
                </button>
              )}
            </div>
          </div>

          <div className="side-stack">
            <section className="task-card" id="tasks">
              <div className="card-title">
                <div>
                  <span className="eyebrow">Проєкти</span>
                  <h2>Головні задачі</h2>
                </div>
                <span className="counter">
                  {visibleTasks.filter((task) => task.done).length}/
                  {visibleTasks.length}
                </span>
              </div>
              <div className="project-tabs">
                {projects.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={activeProject === item.id ? "active" : ""}
                    aria-pressed={activeProject === item.id}
                    onClick={() => selectProject(item.id)}
                  >
                    <i style={{ background: item.color }} />
                    {item.name}
                  </button>
                ))}
              </div>
              <form className="new-project" onSubmit={addProject}>
                <input
                  value={newProject}
                  onChange={(event) => setNewProject(event.target.value)}
                  placeholder="Новий проєкт…"
                />
                <button type="submit">+</button>
              </form>
              <div className="task-list">
                {visibleTasks.map((task) => (
                  <div
                    className={`task ${task.done ? "done" : ""}`}
                    key={task.id}
                  >
                    <button
                      type="button"
                      className="check"
                      aria-label="Змінити статус"
                      onClick={() =>
                        setTasks((items) =>
                          items.map((item) =>
                            item.id === task.id
                              ? { ...item, done: !item.done }
                              : item,
                          ),
                        )
                      }
                    >
                      {task.done ? "✓" : ""}
                    </button>
                    <span>
                      {task.text}
                      <small>{project?.name}</small>
                    </span>
                    <button
                      type="button"
                      className="delete"
                      aria-label="Видалити"
                      onClick={() =>
                        setTasks((items) =>
                          items.filter((item) => item.id !== task.id),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <form className="add-task" onSubmit={addTask}>
                <input
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  placeholder="Додати задачу до проєкту…"
                  aria-label="Нова задача"
                />
                <button type="submit" aria-label="Додати задачу">
                  +
                </button>
              </form>
            </section>

            <AudioMixer />
          </div>
        </section>

        <section className="analytics-section" id="analytics">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Аналітика</span>
              <h2>Твій ритм цього тижня</h2>
            </div>
            <strong>
              {Math.floor(totalMinutes / 60)}
              <small>г</small> {totalMinutes % 60}
              <small>хв</small>
            </strong>
          </div>
          <div className="analytics-grid">
            <InteractiveWeek items={weekData} max={maxWeek} />
            <InteractiveBestTime hours={hourData} />
            <button
              className="quote-card"
              type="button"
              onClick={() => setQuote((value) => (value + 1) % quotes.length)}
            >
              <span>“</span>
              <p>{quotes[quote]}</p>
              <small>Нова думка →</small>
            </button>
          </div>
        </section>

        <section className="achievements-section" id="achievements">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Досягнення</span>
              <h2>Маленькі перемоги складаються у великі</h2>
            </div>
            <span className="streak-big">
              <b>{streak}</b> дні поспіль
            </span>
          </div>
          <div className="achievement-grid">
            {achievements.map((item) => (
              <div
                className={`achievement ${item.unlocked ? "unlocked" : ""}`}
                key={item.name}
              >
                <i>{item.unlocked ? "✓" : item.mark}</i>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.unlocked ? "Відкрито" : "Ще попереду"}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="summary-strip">
          <div
            className="progress-ring"
            style={
              { "--value": `${goalProgress * 3.6}deg` } as React.CSSProperties
            }
          >
            <strong>{goalProgress}%</strong>
          </div>
          <div>
            <span className="eyebrow">Денна ціль фокусу</span>
            <p>
              {todayMinutes >= preferences.dailyGoalMinutes
                ? "Ціль виконано. Сильний день!"
                : `${todayMinutes} із ${preferences.dailyGoalMinutes} хв · залишилось ${preferences.dailyGoalMinutes - todayMinutes} хв`}
            </p>
          </div>
          <div className="daily-task-progress">
            <span>
              {completed}/{tasks.length}
            </span>
            <small>задач виконано</small>
          </div>
          <EngineStatus />
          <div className="sync-pill">
            <i className={syncState} />
            {account ? account.email : "Дані збережено на цьому пристрої"}
          </div>
        </section>
        <footer>
          <span>NOVA / 2026</span>
          <p>Менше шуму. Більше сенсу.</p>
          <a href="#top">Нагору ↑</a>
        </footer>
      </section>

      {showSettings && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowSettings(false)}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setShowSettings(false)}
            >
              ×
            </button>
            <span className="eyebrow">Налаштування</span>
            <h2 id="settings-title">Твій власний ритм</h2>
            <p>Налаштуй тривалість циклу так, як працює саме твоя увага.</p>
            <div className="setting-row">
              <label>
                Фокус <small>1–120 хв</small>
              </label>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setPreferences((value) => ({
                      ...value,
                      focusMinutes: Math.max(1, value.focusMinutes - 5),
                    }))
                  }
                >
                  −
                </button>
                <strong>{preferences.focusMinutes}</strong>
                <button
                  type="button"
                  onClick={() =>
                    setPreferences((value) => ({
                      ...value,
                      focusMinutes: Math.min(120, value.focusMinutes + 5),
                    }))
                  }
                >
                  +
                </button>
              </div>
            </div>
            <div className="setting-row">
              <label>
                Перерва <small>1–60 хв</small>
              </label>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setPreferences((value) => ({
                      ...value,
                      breakMinutes: Math.max(1, value.breakMinutes - 1),
                    }))
                  }
                >
                  −
                </button>
                <strong>{preferences.breakMinutes}</strong>
                <button
                  type="button"
                  onClick={() =>
                    setPreferences((value) => ({
                      ...value,
                      breakMinutes: Math.min(60, value.breakMinutes + 1),
                    }))
                  }
                >
                  +
                </button>
              </div>
            </div>
            <label className="toggle-row">
              <span>
                <b>Автоматичний Pomodoro</b>
                <small>Чергує фокус і перерву без натискань</small>
              </span>
              <input
                type="checkbox"
                checked={preferences.autoPomodoro}
                onChange={(event) =>
                  setPreferences((value) => ({
                    ...value,
                    autoPomodoro: event.target.checked,
                  }))
                }
              />
              <i />
            </label>
            <button
              className="save-settings"
              type="button"
              onClick={() => setShowSettings(false)}
            >
              Зберегти налаштування
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
