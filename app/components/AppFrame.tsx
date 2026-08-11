"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useNovaStore } from "./nova-store";

export const navItems = [
  ["focus","01","Фокус","/"],
  ["projects","02","Проєкти","/projects"],
  ["calendar","03","Календар","/calendar"],
  ["analytics","04","Аналітика","/analytics"],
  ["history","05","Історія","/history"],
  ["achievements","06","Нагороди","/achievements"],
  ["account","07","Профіль","/account"],
] as const;

const accentColors=["#dfff00","#67e8b5","#78d6ff","#c7a7ff","#ff7fd1","#ff7a5c","#ffd66b"];

export function AppFrame({ active, children }: { active?: string; children: ReactNode }) {
  const {data,save,ready,syncing,lastSyncedAt}=useNovaStore();
  const pathname=usePathname();
  const current=active??navItems.find(item=>item[3]===pathname)?.[0]??"settings";
  const label=navItems.find(item=>item[0]===current)?.[2]??"Налаштування";
  const activeProject=data.projects.find(project=>project.id===data.preferences.activeProjectId)??data.projects.find(project=>!project.archived);
  const accent=activeProject?.color??"#dfff00";
  const today=new Date();today.setHours(0,0,0,0);const todayMinutes=Math.round(data.sessions.filter(session=>session.startedAt>=today.getTime()).reduce((sum,session)=>sum+session.durationSeconds,0)/60);const goal=data.preferences.dailyGoalMinutes,goalProgress=Math.min(100,Math.round(todayMinutes/Math.max(1,goal)*100));
  const selectProject=(projectId:string)=>save({...data,preferences:{...data.preferences,activeProjectId:projectId}});
  const selectColor=(color:string)=>activeProject&&save({...data,projects:data.projects.map(project=>project.id===activeProject.id?{...project,color,updatedAt:Date.now()}:project)});

  return <main className="app-shell inner-app" style={{"--accent":accent} as CSSProperties}>
    <div className="noise" />
    <a className="skip-link" href="#main-content">Перейти до вмісту</a>
    <aside className="sidebar">
      <a className="brand" href="/"><span>N</span>NOVA</a>
      <section className="sidebar-control" aria-label="Центр керування">
        <div className="sidebar-control-head"><span className="eyebrow">Робочий контекст</span><i className={syncing?"syncing":ready?"ready":"offline"}/></div>
        <label className="sidebar-project-select"><span style={{background:accent}}/><select value={activeProject?.id??""} onChange={event=>selectProject(event.target.value)} aria-label="Активний проєкт">{data.projects.filter(project=>!project.archived).map(project=><option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
        <div className="sidebar-palette" aria-label="Колір активного проєкту">{accentColors.map(color=><button type="button" className={accent.toLowerCase()===color?"active":""} style={{background:color}} onClick={()=>selectColor(color)} aria-label={`Вибрати колір ${color}`} key={color}/>)}</div>
        <div className="sidebar-goal"><div><span>Денна ціль</span><b>{todayMinutes}/{goal} хв</b></div><div><i style={{width:`${goalProgress}%`}}/></div></div>
        <div className="sidebar-actions"><a href="/">▶ <span>Фокус</span></a><button type="button" onClick={()=>window.dispatchEvent(new Event("nova-open-command"))}>＋ <span>Задача</span></button></div>
        <small className="sidebar-sync">{syncing?"Зберігаю зміни…":lastSyncedAt?`Синхронізовано ${new Intl.DateTimeFormat("uk-UA",{hour:"2-digit",minute:"2-digit"}).format(lastSyncedAt)}`:ready?"Офлайн-черга готова":"Завантаження…"}</small>
      </section>
      <nav aria-label="Головна навігація">{navItems.map(([id,number,name,href])=><a key={id} aria-current={current===id?"page":undefined} className={`nav-item ${current===id?"active":""}`} href={href}><i>{number}</i>{name}</a>)}</nav>
      <div className="side-ritual"><span className="eyebrow">Ритуал дня</span><p>Почни з однієї важливої справи.</p><a href="/">Запустити фокус →</a></div>
      <a className={`profile ${current==="settings"?"current":""}`} href="/settings"><span className="avatar">⚙</span><span>Налаштування<small>Твій ритм</small></span><b>→</b></a>
    </aside>
    <section className="workspace inner-workspace" id="main-content">
      <div className="breadcrumb" aria-label="Навігаційний шлях"><a href="/">NOVA</a><span>/</span><b>{label}</b></div>
      {children}
    </section>
  </main>;
}

export function PageTitle({ eyebrow,title,description,action }: { eyebrow:string; title:string; description:string; action?:ReactNode }) {
  return <header className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}
