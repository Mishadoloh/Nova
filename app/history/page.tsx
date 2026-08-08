"use client";

import { AppFrame, PageTitle } from "../components/AppFrame";
import { useNovaStore } from "../components/nova-store";

export default function HistoryPage() {
  const { data } = useNovaStore();
  const sessions = [...data.sessions].sort((a,b)=>b.startedAt-a.startedAt);
  const days = sessions.reduce<Record<string, typeof sessions>>((groups, session) => { const key = new Intl.DateTimeFormat("uk-UA",{day:"numeric",month:"long",year:"numeric"}).format(new Date(session.startedAt)); (groups[key] ??= []).push(session); return groups; },{});
  return <AppFrame active="history">
    <PageTitle eyebrow="Щоденник уваги" title="Історія сесій" description="Усі моменти, коли ти обрав важливе замість термінового." action={<button className="export-button" type="button" onClick={()=>{const blob=new Blob([JSON.stringify(data.sessions,null,2)],{type:"application/json"}); const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download="nova-sessions.json"; link.click(); URL.revokeObjectURL(link.href);}}>Експорт JSON ↓</button>} />
    <section className="history-summary"><div><span className="eyebrow">Усього</span><strong>{sessions.length}</strong><small>сесій</small></div><div><span className="eyebrow">Час</span><strong>{Math.round(sessions.reduce((sum,item)=>sum+item.durationSeconds,0)/3600*10)/10}</strong><small>годин</small></div><div><span className="eyebrow">Середня</span><strong>{sessions.length?Math.round(sessions.reduce((sum,item)=>sum+item.durationSeconds,0)/sessions.length/60):0}</strong><small>хвилин</small></div></section>
    <section className="timeline">{Object.keys(days).length ? Object.entries(days).map(([day,items])=><div className="timeline-day" key={day}><div className="timeline-date"><span>{day}</span><strong>{Math.round(items.reduce((sum,item)=>sum+item.durationSeconds,0)/60)} хв</strong></div><div className="timeline-items">{items.map((session)=>{const project=data.projects.find((item)=>item.id===session.projectId); return <article key={session.id}><i style={{background:project?.color}} /><time>{new Intl.DateTimeFormat("uk-UA",{hour:"2-digit",minute:"2-digit"}).format(new Date(session.startedAt))}</time><div><strong>{project?.name ?? "Фокус"}</strong><small>Глибока робота</small></div><b>{Math.round(session.durationSeconds/60)} хв</b><span>✓</span></article>;})}</div></div>) : <div className="empty-state"><span>00</span><h2>Історія починається тут</h2><p>Заверши першу сесію фокусу — вона з’явиться на цій шкалі.</p><a href="/">Почати фокус →</a></div>}</section>
  </AppFrame>;
}
