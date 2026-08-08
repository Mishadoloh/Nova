"use client";

import { AppFrame, PageTitle } from "../components/AppFrame";
import { useNovaStore } from "../components/nova-store";

export default function AnalyticsPage() {
  const { data } = useNovaStore();
  const total = Math.round(data.sessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60);
  const week = Array.from({ length: 14 }, (_, offset) => { const day = new Date(); day.setHours(0,0,0,0); day.setDate(day.getDate() - (13 - offset)); const end = day.getTime() + 86400000; return { label: day.getDate(), minutes: Math.round(data.sessions.filter((item) => item.startedAt >= day.getTime() && item.startedAt < end).reduce((sum,item) => sum + item.durationSeconds,0)/60) }; });
  const max = Math.max(60, ...week.map((item) => item.minutes));
  const byProject = data.projects.map((project) => ({ ...project, minutes: Math.round(data.sessions.filter((item) => item.projectId === project.id).reduce((sum,item) => sum + item.durationSeconds,0)/60) }));
  return <AppFrame active="analytics">
    <PageTitle eyebrow="Глибше за цифри" title="Аналітика фокусу" description="Побач закономірності, які допомагають тобі рухатися швидше." action={<select className="period-select" aria-label="Період"><option>Останні 14 днів</option><option>Цей місяць</option></select>} />
    <section className="metric-row"><div><span>Загальний фокус</span><strong>{Math.floor(total/60)}г {total%60}хв</strong><small>↑ 18% проти минулого періоду</small></div><div><span>Середня сесія</span><strong>{data.sessions.length ? Math.round(total/data.sessions.length) : 0} хв</strong><small>Оптимальний ритм</small></div><div><span>Завершені задачі</span><strong>{data.tasks.filter((item)=>item.done).length}</strong><small>із {data.tasks.length} запланованих</small></div><div><span>Серія</span><strong>4 дні</strong><small>Особистий рекорд: 7</small></div></section>
    <section className="analytics-main"><div className="big-chart"><div className="panel-heading"><div><span className="eyebrow">Динаміка</span><h2>Хвилини у фокусі</h2></div><span className="trend">+18%</span></div><div className="fourteen-chart">{week.map((day,index) => <div key={index}><span>{day.minutes || ""}</span><i style={{ height: `${Math.max(3, day.minutes/max*100)}%` }} /><small>{day.label}</small></div>)}</div></div><div className="focus-score"><span className="eyebrow">Індекс фокусу</span><div className="score-ring"><strong>84</strong><small>/100</small></div><h2>Сильний ритм</h2><p>Ти краще тримаєш увагу в першій половині дня.</p></div></section>
    <section className="analytics-lower"><div className="category-panel"><span className="eyebrow">За проєктами</span><h2>Куди йде твоя увага</h2>{byProject.map((item) => <div className="category-row" key={item.id}><i style={{ background: item.color }} /><span>{item.name}</span><div><b style={{ width: `${total ? item.minutes/total*100 : 0}%`, background: item.color }} /></div><strong>{item.minutes} хв</strong></div>)}</div><div className="heat-panel"><span className="eyebrow">Продуктивні години</span><h2>Теплова карта дня</h2><div className="heat-grid">{Array.from({length:35},(_,i)=><i key={i} className={i%7===2 || i%11===0 ? "hot" : i%3===0 ? "warm" : ""} />)}</div><div className="heat-labels"><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div></div></section>
  </AppFrame>;
}
