"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Project = { id: string; name: string; color: string; createdAt: number };
type Task = { id: string; projectId: string; text: string; done: boolean; createdAt: number };
type Session = { id: string; projectId: string; startedAt: number; durationSeconds: number };
type Preferences = { focusMinutes: number; breakMinutes: number; autoPomodoro: boolean };
type Account = { displayName: string; email: string };

const now = Date.now();
const defaultProjects: Project[] = [
  { id: "work", name: "Робота", color: "#dfff00", createdAt: now - 3000 },
  { id: "study", name: "Навчання", color: "#78d6ff", createdAt: now - 2000 },
  { id: "personal", name: "Особисте", color: "#ff7a5c", createdAt: now - 1000 },
];
const defaultTasks: Task[] = [
  { id: "task-1", projectId: "work", text: "Завершити головний екран", done: true, createdAt: now - 3000 },
  { id: "task-2", projectId: "work", text: "Підготувати коротку презентацію", done: false, createdAt: now - 2000 },
  { id: "task-3", projectId: "personal", text: "30 хвилин без сповіщень", done: false, createdAt: now - 1000 },
];
const defaultSessions: Session[] = [
  { id: "demo-1", projectId: "work", startedAt: now - 86400000 * 3 + 10 * 3600000, durationSeconds: 2700 },
  { id: "demo-2", projectId: "study", startedAt: now - 86400000 * 2 + 15 * 3600000, durationSeconds: 3600 },
  { id: "demo-3", projectId: "work", startedAt: now - 86400000 + 9 * 3600000, durationSeconds: 4500 },
];
const defaultPreferences: Preferences = { focusMinutes: 25, breakMinutes: 5, autoPomodoro: false };
const colors = ["#dfff00", "#78d6ff", "#ff7a5c", "#c7a7ff", "#ffd66b"];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  const [activeProject, setActiveProject] = useState("work");
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const [sessions, setSessions] = useState<Session[]>(defaultSessions);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [account, setAccount] = useState<Account | null>(null);
  const [syncState, setSyncState] = useState<"offline" | "syncing" | "synced">("offline");
  const [timerMode, setTimerMode] = useState<"focus" | "break">("focus");
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
  const hydrated = useRef(false);
  const serverReady = useRef(false);
  const completionHandled = useRef(false);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode; source: AudioBufferSourceNode; interval?: number } | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem("nova-v2-cache");
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.projects?.length) setProjects(data.projects);
        if (data.tasks) setTasks(data.tasks);
        if (data.sessions) setSessions(data.sessions);
        if (data.preferences) {
          setPreferences(data.preferences);
          setSeconds(data.preferences.focusMinutes * 60);
        }
      } catch { /* offline cache is optional */ }
    }

    fetch("/api/sync").then(async (response) => {
      if (!response.ok) throw new Error("offline");
      const data = await response.json();
      setAccount(data.user);
      if (data.projects?.length) setProjects(data.projects);
      if (data.tasks?.length) setTasks(data.tasks);
      if (data.sessions?.length) setSessions(data.sessions);
      if (data.preferences) {
        setPreferences(data.preferences);
        setSeconds(data.preferences.focusMinutes * 60);
      }
      setSyncState("synced");
      serverReady.current = true;
    }).catch(() => setSyncState("offline")).finally(() => { hydrated.current = true; });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem("nova-v2-cache", JSON.stringify({ projects, tasks, sessions, preferences }));
    if (!serverReady.current || !account) return;
    setSyncState("syncing");
    const timeout = window.setTimeout(() => {
      fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projects, tasks, sessions, preferences }) })
        .then((response) => { if (!response.ok) throw new Error("sync"); setSyncState("synced"); })
        .catch(() => setSyncState("offline"));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [projects, tasks, sessions, preferences, account]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (seconds !== 0 || !running || completionHandled.current) return;
    completionHandled.current = true;
    setRunning(false);
    if (timerMode === "focus") {
      setSessions((items) => [{ id: uid("session"), projectId: activeProject, startedAt: Date.now() - preferences.focusMinutes * 60000, durationSeconds: preferences.focusMinutes * 60 }, ...items]);
    }
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(timerMode === "focus" ? "Фокус завершено ✦" : "Перерва завершена", { body: timerMode === "focus" ? "Час видихнути й відновитися." : "Готовий до нового ривка?" });
    }
    if (preferences.autoPomodoro) {
      const nextMode = timerMode === "focus" ? "break" : "focus";
      setTimerMode(nextMode);
      setSeconds((nextMode === "focus" ? preferences.focusMinutes : preferences.breakMinutes) * 60);
      window.setTimeout(() => { completionHandled.current = false; setRunning(true); }, 900);
    }
  }, [seconds, running, timerMode, activeProject, preferences]);

  useEffect(() => {
    if (!running) setSeconds((timerMode === "focus" ? preferences.focusMinutes : preferences.breakMinutes) * 60);
  }, [preferences.focusMinutes, preferences.breakMinutes, timerMode, running]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.gain.gain.value = volume / 100 * 0.28;
  }, [volume]);

  useEffect(() => () => stopAmbient(), []);

  const stopAmbient = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.interval) window.clearInterval(audio.interval);
    try { audio.source.stop(); audio.ctx.close(); } catch { /* already closed */ }
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
    filter.frequency.value = name === "Дощ" ? 900 : name === "Кавʼярня" ? 520 : 1200;
    const gain = ctx.createGain();
    gain.gain.value = volume / 100 * 0.28;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    const ambient = { ctx, gain, source } as { ctx: AudioContext; gain: GainNode; source: AudioBufferSourceNode; interval?: number };
    if (name === "Ліс") {
      ambient.interval = window.setInterval(() => {
        const oscillator = ctx.createOscillator();
        const birdGain = ctx.createGain();
        oscillator.frequency.setValueAtTime(1550 + Math.random() * 900, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + .12);
        birdGain.gain.setValueAtTime(0, ctx.currentTime);
        birdGain.gain.linearRampToValueAtTime(volume / 100 * .06, ctx.currentTime + .02);
        birdGain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .25);
        oscillator.connect(birdGain).connect(ctx.destination);
        oscillator.start(); oscillator.stop(ctx.currentTime + .26);
      }, 4200);
    }
    audioRef.current = ambient;
    setSoundPlaying(true);
  };

  const resetTimer = (mode = timerMode) => {
    setRunning(false);
    setTimerMode(mode);
    setSeconds((mode === "focus" ? preferences.focusMinutes : preferences.breakMinutes) * 60);
    completionHandled.current = false;
  };

  const toggleTimer = () => {
    if (seconds === 0) resetTimer();
    completionHandled.current = false;
    setRunning((value) => !value);
  };

  const addTask = (event: FormEvent) => {
    event.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    setTasks((items) => [...items, { id: uid("task"), projectId: activeProject, text, done: false, createdAt: Date.now() }]);
    setNewTask("");
  };

  const addProject = (event: FormEvent) => {
    event.preventDefault();
    const name = newProject.trim();
    if (!name) return;
    const project = { id: uid("project"), name, color: colors[projects.length % colors.length], createdAt: Date.now() };
    setProjects((items) => [...items, project]);
    setActiveProject(project.id);
    setNewProject("");
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
  };

  const project = projects.find((item) => item.id === activeProject) ?? projects[0];
  const visibleTasks = tasks.filter((task) => task.projectId === activeProject);
  const completed = tasks.filter((task) => task.done).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const totalSeconds = (timerMode === "focus" ? preferences.focusMinutes : preferences.breakMinutes) * 60;
  const timerProgress = totalSeconds ? 1 - seconds / totalSeconds : 0;
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const date = useMemo(() => new Intl.DateTimeFormat("uk-UA", { weekday: "long", day: "numeric", month: "long" }).format(new Date()), []);
  const totalMinutes = Math.round(sessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
  const level = Math.floor(totalMinutes / 120) + 1;
  const activeDays = new Set(sessions.map((session) => new Date(session.startedAt).toDateString()));
  let streak = 0;
  for (let index = 0; index < 365; index++) {
    const day = new Date(); day.setDate(day.getDate() - index);
    if (activeDays.has(day.toDateString())) streak++; else if (index > 0) break;
  }
  const weekData = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (6 - offset));
    const next = day.getTime() + 86400000;
    const minutes = Math.round(sessions.filter((session) => session.startedAt >= day.getTime() && session.startedAt < next).reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
    return { label: new Intl.DateTimeFormat("uk-UA", { weekday: "short" }).format(day).slice(0, 2), minutes };
  });
  const maxWeek = Math.max(60, ...weekData.map((item) => item.minutes));
  const hourData = Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: sessions.filter((session) => new Date(session.startedAt).getHours() === hour).reduce((sum, session) => sum + session.durationSeconds / 60, 0) }));
  const productiveHour = hourData.sort((a, b) => b.minutes - a.minutes)[0]?.hour ?? 9;
  const achievements = [
    { name: "Перший крок", mark: "01", unlocked: sessions.length >= 1 },
    { name: "Глибока хвиля", mark: "02", unlocked: totalMinutes >= 120 },
    { name: "Майстер справ", mark: "03", unlocked: completed >= 5 },
    { name: "Серія 7", mark: "07", unlocked: streak >= 7 },
  ];
  const quotes = ["Те, на чому ти фокусуєшся, росте.", "Один чистий крок важить більше десяти планів.", "Захисти увагу — і день стане твоїм."];

  return (
    <main className={`app-shell ${zen ? "zen-mode" : ""}`} style={{ "--accent": project?.color ?? "#dfff00" } as React.CSSProperties}>
      <div className="noise" />
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="NOVA — на початок"><span>N</span>NOVA</a>
        <nav aria-label="Головна навігація">
          <a className="nav-item active" href="#focus"><i>01</i>Фокус</a>
          <a className="nav-item" href="#tasks"><i>02</i>Проєкти</a>
          <a className="nav-item" href="#analytics"><i>03</i>Статистика</a>
          <a className="nav-item" href="#achievements"><i>04</i>Нагороди</a>
        </nav>
        <div className="level-card"><span className="eyebrow">Рівень {level}</span><strong>{totalMinutes}<small> хв фокусу</small></strong><div><i style={{ width: `${totalMinutes % 120 / 1.2}%` }} /></div></div>
        <button className="profile" type="button"><span className="avatar">{account?.displayName?.[0]?.toUpperCase() ?? "N"}</span><span>{account?.displayName?.split(" ")[0] ?? "Локальний профіль"}<small>{syncState === "synced" ? "✓ Синхронізовано" : syncState === "syncing" ? "Синхронізація…" : "Офлайн-режим"}</small></span><b>•••</b></button>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <div><span className="eyebrow">Сьогодні</span><p>{date}</p></div>
          <div className="top-actions">
            <button type="button" onClick={requestNotifications} aria-label="Увімкнути сповіщення">♢</button>
            <button type="button" onClick={() => setShowSettings(true)} aria-label="Налаштування таймера">⚙</button>
            <button className="status" type="button" onClick={() => setZen(true)}><i /> Без відволікань</button>
          </div>
        </header>

        <div className="hero-copy">
          <span className="kicker">ТВІЙ ЧАС. ТВОЇ ПРАВИЛА.</span>
          <h1>Злови <em>ритм.</em><br />Зроби важливе.</h1>
          <p>Один простір для глибокої роботи — тепер із синхронізацією, аналітикою та власним ритмом.</p>
        </div>

        <section className="focus-grid" id="focus">
          <div className="timer-card">
            <div className="timer-head"><span className="eyebrow">{timerMode === "focus" ? `Фокус · ${project?.name}` : "Відновлення"}</span><div><button type="button" onClick={() => resetTimer()} aria-label="Скинути таймер">↻</button>{zen && <button className="exit-zen" type="button" onClick={() => setZen(false)}>Вийти ×</button>}</div></div>
            <div className="mode-tabs" role="tablist" aria-label="Режим таймера">
              <button type="button" role="tab" aria-selected={timerMode === "focus"} className={timerMode === "focus" ? "selected" : ""} onClick={() => resetTimer("focus")}>Фокус · {preferences.focusMinutes} хв</button>
              <button type="button" role="tab" aria-selected={timerMode === "break"} className={timerMode === "break" ? "selected" : ""} onClick={() => resetTimer("break")}>Перерва · {preferences.breakMinutes} хв</button>
            </div>
            <div className="timer-wrap"><div className="orbit" style={{ "--progress": `${timerProgress * 360}deg` } as React.CSSProperties}><div className="timer-core"><span>{timerMode === "focus" ? "Глибокий фокус" : "Час відновитись"}</span><strong>{time}</strong><small>{running ? "Тримай темп" : seconds === 0 ? "Сесію завершено" : "Готовий почати?"}</small></div></div></div>
            <div className="timer-actions"><button className="start-button" type="button" onClick={toggleTimer}><span>{running ? "Ⅱ" : "▶"}</span>{running ? "Пауза" : seconds === 0 ? "Ще одна сесія" : "Почати"}</button>{running && !zen && <button className="zen-button" type="button" onClick={() => setZen(true)}>Режим блокування ↗</button>}</div>
          </div>

          <div className="side-stack">
            <section className="task-card" id="tasks">
              <div className="card-title"><div><span className="eyebrow">Проєкти</span><h2>Головні задачі</h2></div><span className="counter">{visibleTasks.filter((task) => task.done).length}/{visibleTasks.length}</span></div>
              <div className="project-tabs">{projects.map((item) => <button key={item.id} type="button" className={activeProject === item.id ? "active" : ""} onClick={() => setActiveProject(item.id)}><i style={{ background: item.color }} />{item.name}</button>)}</div>
              <form className="new-project" onSubmit={addProject}><input value={newProject} onChange={(event) => setNewProject(event.target.value)} placeholder="Новий проєкт…" /><button type="submit">+</button></form>
              <div className="task-list">{visibleTasks.map((task) => <div className={`task ${task.done ? "done" : ""}`} key={task.id}><button type="button" className="check" aria-label="Змінити статус" onClick={() => setTasks((items) => items.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}>{task.done ? "✓" : ""}</button><span>{task.text}<small>{project?.name}</small></span><button type="button" className="delete" aria-label="Видалити" onClick={() => setTasks((items) => items.filter((item) => item.id !== task.id))}>×</button></div>)}</div>
              <form className="add-task" onSubmit={addTask}><input value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Додати задачу до проєкту…" aria-label="Нова задача" /><button type="submit" aria-label="Додати задачу">+</button></form>
            </section>

            <section className="sound-card">
              <div className="sound-heading"><div><span className="eyebrow">Атмосфера</span><h2>{soundPlaying ? `${sound} звучить` : "Звук для потоку"}</h2></div><button type="button" className="sound-stop" onClick={stopAmbient}>{soundPlaying ? "■" : "·"}</button></div>
              <div className="sound-options">{[["Дощ", "◌"], ["Кавʼярня", "≋"], ["Ліс", "⌁"], ["Тиша", "·"]].map(([item, icon]) => <button type="button" key={item} className={sound === item ? "active" : ""} onClick={() => playAmbient(item)}><i>{icon}</i><span>{item}</span></button>)}</div>
              <label className="volume"><span>Гучність</span><input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><b>{volume}%</b></label>
            </section>
          </div>
        </section>

        <section className="analytics-section" id="analytics">
          <div className="section-heading"><div><span className="eyebrow">Аналітика</span><h2>Твій ритм цього тижня</h2></div><strong>{Math.floor(totalMinutes / 60)}<small>г</small> {totalMinutes % 60}<small>хв</small></strong></div>
          <div className="analytics-grid">
            <div className="week-chart"><div className="chart-grid">{weekData.map((day) => <div className="chart-column" key={day.label}><span>{day.minutes ? `${day.minutes} хв` : ""}</span><i style={{ height: `${Math.max(4, day.minutes / maxWeek * 100)}%` }} /><small>{day.label}</small></div>)}</div></div>
            <div className="best-time"><span className="eyebrow">Найсильніша година</span><strong>{String(productiveHour).padStart(2, "0")}:00</strong><p>У цей час ти найдовше залишаєшся у фокусі.</p><div className="hour-line">{[6, 9, 12, 15, 18, 21].map((hour) => <i key={hour} className={Math.abs(hour - productiveHour) < 2 ? "hot" : ""}><span>{hour}</span></i>)}</div></div>
            <button className="quote-card" type="button" onClick={() => setQuote((value) => (value + 1) % quotes.length)}><span>“</span><p>{quotes[quote]}</p><small>Нова думка →</small></button>
          </div>
        </section>

        <section className="achievements-section" id="achievements">
          <div className="section-heading"><div><span className="eyebrow">Досягнення</span><h2>Маленькі перемоги складаються у великі</h2></div><span className="streak-big"><b>{streak}</b> дні поспіль</span></div>
          <div className="achievement-grid">{achievements.map((item) => <div className={`achievement ${item.unlocked ? "unlocked" : ""}`} key={item.name}><i>{item.unlocked ? "✓" : item.mark}</i><div><strong>{item.name}</strong><small>{item.unlocked ? "Відкрито" : "Ще попереду"}</small></div></div>)}</div>
        </section>

        <section className="summary-strip"><div className="progress-ring" style={{ "--value": `${progress * 3.6}deg` } as React.CSSProperties}><strong>{progress}%</strong></div><div><span className="eyebrow">Денний прогрес</span><p>{completed === tasks.length && tasks.length ? "Усе виконано. Сильний день!" : `Виконано ${completed} із ${tasks.length} задач`}</p></div><div className="sync-pill"><i className={syncState} />{account ? account.email : "Дані збережено на цьому пристрої"}</div></section>
        <footer><span>NOVA / 2026</span><p>Менше шуму. Більше сенсу.</p><a href="#top">Нагору ↑</a></footer>
      </section>

      {showSettings && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowSettings(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setShowSettings(false)}>×</button><span className="eyebrow">Налаштування</span><h2 id="settings-title">Твій власний ритм</h2><p>Налаштуй тривалість циклу так, як працює саме твоя увага.</p><div className="setting-row"><label>Фокус <small>1–120 хв</small></label><div><button type="button" onClick={() => setPreferences((value) => ({ ...value, focusMinutes: Math.max(1, value.focusMinutes - 5) }))}>−</button><strong>{preferences.focusMinutes}</strong><button type="button" onClick={() => setPreferences((value) => ({ ...value, focusMinutes: Math.min(120, value.focusMinutes + 5) }))}>+</button></div></div><div className="setting-row"><label>Перерва <small>1–60 хв</small></label><div><button type="button" onClick={() => setPreferences((value) => ({ ...value, breakMinutes: Math.max(1, value.breakMinutes - 1) }))}>−</button><strong>{preferences.breakMinutes}</strong><button type="button" onClick={() => setPreferences((value) => ({ ...value, breakMinutes: Math.min(60, value.breakMinutes + 1) }))}>+</button></div></div><label className="toggle-row"><span><b>Автоматичний Pomodoro</b><small>Чергує фокус і перерву без натискань</small></span><input type="checkbox" checked={preferences.autoPomodoro} onChange={(event) => setPreferences((value) => ({ ...value, autoPomodoro: event.target.checked }))} /><i /></label><button className="save-settings" type="button" onClick={() => setShowSettings(false)}>Зберегти налаштування</button></section></div>}
    </main>
  );
}
