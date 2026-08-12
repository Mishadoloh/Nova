"use client";

import { AppFrame, PageTitle } from "../components/AppFrame";
import { useNovaStore } from "../components/nova-store";

export default function AccountPage() {
  const { data, account, ready, syncing } = useNovaStore();
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nova-backup.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <AppFrame active="account">
    <PageTitle eyebrow="Твій простір" title="Профіль і синхронізація" description="NOVA памʼятає твій ритм на всіх пристроях." action={<a className="profile-edit-link" href="/register">Налаштувати профіль →</a>} />
    <section className="account-card"><div className="account-avatar">{account?.displayName?.[0]?.toUpperCase() ?? "N"}</div><div><span className="eyebrow">ChatGPT account</span><h2>{account?.displayName ?? (ready ? "Локальний профіль" : "Завантаження…")}</h2><p>{account?.email ?? "Увійди через ChatGPT, щоб синхронізувати дані"}</p></div><span className={`account-sync ${account ? "online" : ""}`}><i />{syncing ? "Синхронізація…" : account ? "Синхронізовано" : "Локально"}</span></section>
    <section className="account-grid"><article><span className="eyebrow">У хмарі</span><h2>Твої дані</h2><div className="data-list"><span><i>◫</i>Проєкти<b>{data.projects.length}</b></span><span><i>✓</i>Задачі<b>{data.tasks.length}</b></span><span><i>◷</i>Сесії фокусу<b>{data.sessions.length}</b></span></div><button type="button" onClick={exportData}>Завантажити резервну копію ↓</button></article><article><span className="eyebrow">Безпека</span><h2>Приватний простір</h2><p>Дані привʼязані до твого облікового запису та недоступні іншим користувачам.</p><div className="security-row"><span>Захищений вхід</span><b>Увімкнено</b></div><div className="security-row"><span>Синхронізація</span><b>{account ? "Активна" : "Офлайн"}</b></div><a className="signout" href="/signout-with-chatgpt?return_to=/">Вийти з акаунта</a></article></section>
  </AppFrame>;
}
