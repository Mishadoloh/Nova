"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Task = { id: number; text: string; done: boolean; tag: string };

const modes = [
  { name: "Глибокий фокус", minutes: 25, accent: "#dfff00" },
  { name: "Швидкий ривок", minutes: 10, accent: "#ff7a5c" },
  { name: "Перезавантаження", minutes: 5, accent: "#78d6ff" },
];

const starterTasks: Task[] = [
  { id: 1, text: "Завершити головний екран", done: true, tag: "Дизайн" },
  { id: 2, text: "Підготувати коротку презентацію", done: false, tag: "Робота" },
  { id: 3, text: "30 хвилин без сповіщень", done: false, tag: "Фокус" },
];

export default function Home() {
  const [mode, setMode] = useState(0);
  const [seconds, setSeconds] = useState(modes[0].minutes * 60);
  const [running, setRunning] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(starterTasks);
  const [newTask, setNewTask] = useState("");
  const [sound, setSound] = useState("Дощ");
  const [quote, setQuote] = useState(0);
  const hydrated = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("nova-tasks");
    if (saved) {
      try { setTasks(JSON.parse(saved)); } catch { /* keep starter data */ }
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (hydrated.current) localStorage.setItem("nova-tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const selectMode = (index: number) => {
    setMode(index);
    setRunning(false);
    setSeconds(modes[index].minutes * 60);
  };

  const resetTimer = () => {
    setRunning(false);
    setSeconds(modes[mode].minutes * 60);
  };

  const addTask = (event: FormEvent) => {
    event.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    setTasks((items) => [...items, { id: Date.now(), text, done: false, tag: "Нове" }]);
    setNewTask("");
  };

  const completed = tasks.filter((task) => task.done).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const timerProgress = 1 - seconds / (modes[mode].minutes * 60);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const date = useMemo(() => new Intl.DateTimeFormat("uk-UA", { weekday: "long", day: "numeric", month: "long" }).format(new Date()), []);
  const quotes = ["Те, на чому ти фокусуєшся, росте.", "Один чистий крок важить більше десяти планів.", "Захисти увагу — і день стане твоїм."];

  return (
    <main className="app-shell" style={{ "--accent": modes[mode].accent } as React.CSSProperties}>
      <div className="noise" />
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="NOVA — на початок"><span>N</span>NOVA</a>
        <nav aria-label="Головна навігація">
          <a className="nav-item active" href="#focus"><i>01</i>Фокус</a>
          <a className="nav-item" href="#tasks"><i>02</i>Задачі</a>
          <a className="nav-item" href="#insights"><i>03</i>Прогрес</a>
        </nav>
        <div className="streak-card">
          <span className="eyebrow">Серія</span>
          <strong>7 <small>днів</small></strong>
          <div className="week" aria-label="7 днів поспіль">
            {["П", "В", "С", "Ч", "П", "С", "Н"].map((day, index) => <span key={day + index} className={index === 6 ? "today" : ""}>{day}</span>)}
          </div>
        </div>
        <button className="profile" type="button"><span className="avatar">О</span><span>Олексій<small>Твій простір</small></span><b>•••</b></button>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <div><span className="eyebrow">Сьогодні</span><p>{date}</p></div>
          <div className="top-actions"><button type="button" aria-label="Сповіщення">↗</button><button className="status" type="button"><i /> У потоці</button></div>
        </header>

        <div className="hero-copy">
          <span className="kicker">ТВІЙ ЧАС. ТВОЇ ПРАВИЛА.</span>
          <h1>Злови <em>ритм.</em><br />Зроби важливе.</h1>
          <p>Один простір для глибокої роботи — без зайвого шуму.</p>
        </div>

        <section className="focus-grid" id="focus">
          <div className="timer-card">
            <div className="timer-head"><span className="eyebrow">Сесія фокусу</span><button type="button" onClick={resetTimer} aria-label="Скинути таймер">↻</button></div>
            <div className="mode-tabs" role="tablist" aria-label="Режим таймера">
              {modes.map((item, index) => <button key={item.name} type="button" role="tab" aria-selected={mode === index} className={mode === index ? "selected" : ""} onClick={() => selectMode(index)}>{item.minutes} хв</button>)}
            </div>
            <div className="timer-wrap">
              <div className="orbit" style={{ "--progress": `${timerProgress * 360}deg` } as React.CSSProperties}>
                <div className="timer-core"><span>{modes[mode].name}</span><strong>{time}</strong><small>{running ? "Тримай темп" : seconds === 0 ? "Сесію завершено" : "Готовий почати?"}</small></div>
              </div>
            </div>
            <button className="start-button" type="button" onClick={() => seconds === 0 ? resetTimer() : setRunning((value) => !value)}><span>{running ? "Ⅱ" : "▶"}</span>{seconds === 0 ? "Ще одна сесія" : running ? "Пауза" : "Почати фокус"}</button>
          </div>

          <div className="side-stack">
            <section className="task-card" id="tasks">
              <div className="card-title"><div><span className="eyebrow">Сьогодні</span><h2>Головні задачі</h2></div><span className="counter">{completed}/{tasks.length}</span></div>
              <div className="task-list">
                {tasks.map((task) => (
                  <div className={`task ${task.done ? "done" : ""}`} key={task.id}>
                    <button type="button" className="check" aria-label={task.done ? "Позначити незавершеною" : "Позначити виконаною"} onClick={() => setTasks((items) => items.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}>{task.done ? "✓" : ""}</button>
                    <span>{task.text}<small>{task.tag}</small></span>
                    <button type="button" className="delete" aria-label="Видалити задачу" onClick={() => setTasks((items) => items.filter((item) => item.id !== task.id))}>×</button>
                  </div>
                ))}
              </div>
              <form className="add-task" onSubmit={addTask}><input value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Додати важливу задачу…" aria-label="Нова задача" /><button type="submit" aria-label="Додати задачу">+</button></form>
            </section>

            <section className="sound-card">
              <div><span className="eyebrow">Атмосфера</span><h2>Звук для потоку</h2></div>
              <div className="sound-options">
                {["Дощ", "Кавʼярня", "Тиша"].map((item, index) => <button type="button" key={item} className={sound === item ? "active" : ""} onClick={() => setSound(item)}><i>{["◌", "≋", "·"][index]}</i><span>{item}</span></button>)}
              </div>
            </section>
          </div>
        </section>

        <section className="insights" id="insights">
          <div className="insight-stat"><span className="eyebrow">Фокус сьогодні</span><strong>2<span>г</span> 35<span>хв</span></strong><div className="mini-bars">{[42, 70, 55, 88, 64, 92, 76].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
          <button className="quote-card" type="button" onClick={() => setQuote((value) => (value + 1) % quotes.length)}><span>“</span><p>{quotes[quote]}</p><small>Натисни для нової думки →</small></button>
          <div className="progress-card"><div className="progress-ring" style={{ "--value": `${progress * 3.6}deg` } as React.CSSProperties}><strong>{progress}%</strong></div><div><span className="eyebrow">Денний прогрес</span><p>{completed === tasks.length && tasks.length ? "Все виконано. Сильний день!" : `Ще ${tasks.length - completed} ${tasks.length - completed === 1 ? "задача" : "задачі"} до фінішу`}</p></div></div>
        </section>
        <footer><span>NOVA / 2026</span><p>Менше шуму. Більше сенсу.</p><a href="#top">Нагору ↑</a></footer>
      </section>
    </main>
  );
}
