"use client";

import { FormEvent, useState } from "react";
import { AppFrame, PageTitle } from "../components/AppFrame";
import { useNovaStore } from "../components/nova-store";

export default function ProjectsPage() {
  const { data, save, syncing } = useNovaStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const active = selected ?? data.projects[0]?.id;
  const project = data.projects.find((item) => item.id === active);
  const addTask = (event: FormEvent) => {
    event.preventDefault(); if (!draft.trim() || !active) return;
    save({ ...data, tasks: [...data.tasks, { id: `task-${Date.now()}`, projectId: active, text: draft.trim(), done: false, createdAt: Date.now() }] }); setDraft("");
  };
  const toggle = (id: string) => save({ ...data, tasks: data.tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task) });
  const current = data.tasks.filter((task) => task.projectId === active);
  return <AppFrame active="projects">
    <PageTitle eyebrow="Робочий простір" title="Проєкти" description="Розклади велике на зрозумілі кроки й тримай курс." action={<span className="page-status">{syncing ? "Зберігаю…" : "Усе синхронізовано"}</span>} />
    <section className="project-overview">{data.projects.map((item) => { const tasks = data.tasks.filter((task) => task.projectId === item.id); const done = tasks.filter((task) => task.done).length; return <button type="button" key={item.id} className={`project-tile ${active === item.id ? "active" : ""}`} onClick={() => setSelected(item.id)} style={{ "--project": item.color } as React.CSSProperties}><i /><span className="eyebrow">{tasks.length} задач</span><h2>{item.name}</h2><div><b style={{ width: `${tasks.length ? done / tasks.length * 100 : 0}%` }} /></div><small>{done} виконано · {tasks.length - done} у роботі</small></button>; })}</section>
    <section className="project-detail"><div className="project-detail-head"><div><span className="eyebrow">Активний проєкт</span><h2>{project?.name ?? "Обери проєкт"}</h2></div><strong>{current.filter((task) => task.done).length}/{current.length}</strong></div>
      <div className="board-columns">
        <div className="board-column"><h3>Зробити <span>{current.filter((task) => !task.done).length}</span></h3>{current.filter((task) => !task.done).map((task) => <button type="button" className="board-task" onClick={() => toggle(task.id)} key={task.id}><i />{task.text}<small>Позначити готовим →</small></button>)}<form onSubmit={addTask}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Нова задача…" /><button type="submit">+</button></form></div>
        <div className="board-column completed"><h3>Готово <span>{current.filter((task) => task.done).length}</span></h3>{current.filter((task) => task.done).map((task) => <button type="button" className="board-task" onClick={() => toggle(task.id)} key={task.id}><i>✓</i>{task.text}<small>Повернути в роботу →</small></button>)}</div>
      </div>
    </section>
  </AppFrame>;
}
