import type { ReactNode } from "react";

const items = [
  ["focus", "01", "Фокус", "/"],
  ["projects", "02", "Проєкти", "/projects"],
  ["analytics", "03", "Аналітика", "/analytics"],
  ["history", "04", "Історія", "/history"],
  ["achievements", "05", "Нагороди", "/achievements"],
  ["account", "06", "Профіль", "/account"],
];

export function AppFrame({ active, children }: { active: string; children: ReactNode }) {
  return <main className="app-shell inner-app">
    <div className="noise" />
    <aside className="sidebar">
      <a className="brand" href="/"><span>N</span>NOVA</a>
      <nav aria-label="Головна навігація">{items.map(([id, number, label, href]) => <a key={id} className={`nav-item ${active === id ? "active" : ""}`} href={href}><i>{number}</i>{label}</a>)}</nav>
      <div className="side-ritual"><span className="eyebrow">Ритуал дня</span><p>Почни з однієї важливої справи.</p><a href="/">Запустити фокус →</a></div>
      <a className="profile" href="/settings"><span className="avatar">⚙</span><span>Налаштування<small>Твій ритм</small></span><b>→</b></a>
    </aside>
    <section className="workspace inner-workspace">{children}</section>
  </main>;
}

export function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}
