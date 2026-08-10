"use client";

import { useMemo, useState } from "react";
import { AppFrame, PageTitle } from "../components/AppFrame";
import { useNovaStore } from "../components/nova-store";

export default function HistoryPage() {
  const { data, save, syncing } = useNovaStore();
  const [query,setQuery]=useState("");
  const [projectId,setProjectId]=useState("all");
  const [range,setRange]=useState("all");
  const cutoff=range==="all"?0:Date.now()-Number(range)*86400000;
  const sessions=useMemo(()=>[...data.sessions].filter(session=>{const project=data.projects.find(item=>item.id===session.projectId);return session.startedAt>=cutoff&&(projectId==="all"||session.projectId===projectId)&&(project?.name??"Фокус").toLowerCase().includes(query.trim().toLowerCase())}).sort((a,b)=>b.startedAt-a.startedAt),[data.sessions,data.projects,cutoff,projectId,query]);
  const days=sessions.reduce<Record<string,typeof sessions>>((groups,session)=>{const key=new Intl.DateTimeFormat("uk-UA",{day:"numeric",month:"long",year:"numeric"}).format(new Date(session.startedAt));(groups[key]??=[]).push(session);return groups},{});
  const totalMinutes=Math.round(sessions.reduce((sum,item)=>sum+item.durationSeconds,0)/60);
  const remove=(id:string)=>{if(window.confirm("Видалити цю фокус-сесію з історії?"))save({...data,sessions:data.sessions.filter(item=>item.id!==id)})};
  const download=(format:"json"|"csv")=>{const content=format==="json"?JSON.stringify(sessions,null,2):["date,project,duration_minutes",...sessions.map(item=>`${new Date(item.startedAt).toISOString()},${data.projects.find(project=>project.id===item.projectId)?.name??"Focus"},${Math.round(item.durationSeconds/60)}`)].join("\n");const blob=new Blob([content],{type:format==="json"?"application/json":"text/csv"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`nova-sessions.${format}`;link.click();URL.revokeObjectURL(link.href)};

  return <AppFrame active="history">
    <PageTitle eyebrow="Щоденник уваги" title="Історія сесій" description="Знаходь, фільтруй та керуй усіма завершеними фокус-сесіями." action={<div className="history-export"><button type="button" onClick={()=>download("csv")}>CSV ↓</button><button type="button" onClick={()=>download("json")}>JSON ↓</button></div>} />
    <section className="history-tools">
      <label><span>Пошук</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Назва проєкту…" /></label>
      <label><span>Проєкт</span><select value={projectId} onChange={event=>setProjectId(event.target.value)}><option value="all">Усі проєкти</option>{data.projects.map(project=><option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
      <label><span>Період</span><select value={range} onChange={event=>setRange(event.target.value)}><option value="all">За весь час</option><option value="7">7 днів</option><option value="30">30 днів</option><option value="90">90 днів</option></select></label>
      <button type="button" onClick={()=>{setQuery("");setProjectId("all");setRange("all")}}>Скинути</button>
    </section>
    <section className="history-summary"><div><span className="eyebrow">Знайдено</span><strong>{sessions.length}</strong><small>сесій</small></div><div><span className="eyebrow">Час</span><strong>{Math.round(totalMinutes/60*10)/10}</strong><small>годин</small></div><div><span className="eyebrow">Середня</span><strong>{sessions.length?Math.round(totalMinutes/sessions.length):0}</strong><small>хвилин</small></div></section>
    <section className="timeline">{Object.keys(days).length?Object.entries(days).map(([day,items])=><div className="timeline-day" key={day}><div className="timeline-date"><span>{day}</span><strong>{Math.round(items.reduce((sum,item)=>sum+item.durationSeconds,0)/60)} хв</strong></div><div className="timeline-items">{items.map(session=>{const project=data.projects.find(item=>item.id===session.projectId);return <article key={session.id}><i style={{background:project?.color}}/><time>{new Intl.DateTimeFormat("uk-UA",{hour:"2-digit",minute:"2-digit"}).format(new Date(session.startedAt))}</time><div><strong>{project?.name??"Фокус"}</strong><small>{new Intl.DateTimeFormat("uk-UA",{weekday:"long"}).format(new Date(session.startedAt))}</small></div><b>{Math.round(session.durationSeconds/60)} хв</b><div className="session-actions"><span>✓</span><button type="button" disabled={syncing} onClick={()=>remove(session.id)} aria-label="Видалити сесію">×</button></div></article>})}</div></div>):<div className="empty-state"><span>00</span><h2>Нічого не знайдено</h2><p>Зміни фільтри або заверши нову фокус-сесію.</p><button type="button" onClick={()=>{setQuery("");setProjectId("all");setRange("all")}}>Очистити фільтри</button></div>}</section>
  </AppFrame>;
}
