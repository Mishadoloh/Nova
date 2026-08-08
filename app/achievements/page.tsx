"use client";

import { AppFrame, PageTitle } from "../components/AppFrame";
import { useNovaStore } from "../components/nova-store";

const badges = [
  ["Перший крок", "Заверши першу сесію", 1, "session"], ["Глибока хвиля", "Накопич 2 години фокусу", 120, "minutes"], ["Майстер ритму", "Накопич 10 годин", 600, "minutes"], ["Справи говорять", "Виконай 5 задач", 5, "tasks"], ["Точність", "Виконай 20 задач", 20, "tasks"], ["Незламна серія", "7 днів поспіль", 7, "locked"], ["Ранній старт", "Сесія до 08:00", 1, "early"], ["Нічний потік", "Сесія після 22:00", 1, "night"],
] as const;

export default function AchievementsPage() {
  const { data } = useNovaStore();
  const minutes = Math.round(data.sessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60);
  const done = data.tasks.filter((item) => item.done).length;
  const value = (type: string) => type === "session" ? data.sessions.length : type === "minutes" ? minutes : type === "tasks" ? done : type === "early" ? data.sessions.filter((item)=>new Date(item.startedAt).getHours()<8).length : type === "night" ? data.sessions.filter((item)=>new Date(item.startedAt).getHours()>=22).length : 0;
  const level = Math.floor(minutes / 120) + 1; const levelProgress = minutes % 120;
  return <AppFrame active="achievements">
    <PageTitle eyebrow="Твоя колекція" title="Досягнення" description="Кожна сфокусована хвилина — доказ того, що ти рухаєшся вперед." />
    <section className="level-hero"><div className="level-orbit"><span>Рівень</span><strong>{level}</strong></div><div><span className="eyebrow">Наступна вершина</span><h2>Архітектор уваги</h2><p>Ще {120-levelProgress} хвилин фокусу до наступного рівня.</p><div className="level-progress"><i style={{width:`${levelProgress/1.2}%`}} /></div><small>{levelProgress} / 120 хв</small></div><div className="level-stats"><span><b>{data.sessions.length}</b> сесій</span><span><b>{minutes}</b> хвилин</span><span><b>{done}</b> справ</span></div></section>
    <div className="collection-head"><h2>Колекція нагород</h2><span>{badges.filter((badge)=>value(badge[3])>=badge[2]).length} із {badges.length} відкрито</span></div>
    <section className="badge-grid">{badges.map(([name, description, target, type], index) => { const current = value(type); const unlocked = current >= target; return <article className={`badge-card ${unlocked ? "unlocked" : ""}`} key={name}><div className="badge-mark"><span>{unlocked ? "✓" : String(index+1).padStart(2,"0")}</span></div><div><span className="eyebrow">{unlocked ? "Відкрито" : `${Math.min(current,target)} / ${target}`}</span><h3>{name}</h3><p>{description}</p>{!unlocked && <div className="badge-progress"><i style={{width:`${Math.min(100,current/target*100)}%`}} /></div>}</div></article>; })}</section>
  </AppFrame>;
}
