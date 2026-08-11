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

export function AppFrame({ active, children }: { active?: string; children: ReactNode }) {
  const {data}=useNovaStore();
  const pathname=usePathname();
  const current=active??navItems.find(item=>item[3]===pathname)?.[0]??"settings";
  const label=navItems.find(item=>item[0]===current)?.[2]??"Налаштування";
  const activeProject=data.projects.find(project=>project.id===data.preferences.activeProjectId)??data.projects.find(project=>!project.archived);
  const accent=activeProject?.color??"#dfff00";

  return <main className="app-shell inner-app" style={{"--accent":accent} as CSSProperties}>
    <div className="noise" />
    <a className="skip-link" href="#main-content">Перейти до вмісту</a>
    <aside className="sidebar">
      <a className="brand" href="/"><span>N</span>NOVA</a>
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
