"use client";

import { AppFrame, PageTitle } from "../components/AppFrame";
import { useNovaStore } from "../components/nova-store";
import { supabase } from "../lib/supabase";
import { BackendActivity } from "../components/BackendActivity";
import { BackupManager } from "../components/BackupManager";

export default function AccountPage() {
  const { data, account, ready, syncing, refresh } = useNovaStore();
  const signOut = async () => { await supabase.auth.signOut(); localStorage.removeItem("nova-v3-cache"); localStorage.removeItem("nova-sync-queue"); window.location.replace("/register"); };

  return <AppFrame active="account">
    <PageTitle eyebrow="Твій простір" title="Профіль і синхронізація" description="NOVA памʼятає твій ритм на всіх пристроях." action={<a className="profile-edit-link" href="/register">Налаштувати профіль →</a>} />
    <section className="account-card"><div className="account-avatar">{account?.displayName?.[0]?.toUpperCase() ?? "N"}</div><div><span className="eyebrow">NOVA account</span><h2>{account?.displayName ?? (ready ? "Профіль NOVA" : "Завантаження…")}</h2><p>{account?.email ?? "Захищена сесія Supabase"}</p></div><span className={`account-sync ${account ? "online" : ""}`}><i />{syncing ? "Синхронізація…" : account ? "Синхронізовано" : "Підключення"}</span></section>
    <section className="account-grid"><article><span className="eyebrow">У хмарі</span><h2>Твої дані</h2><div className="data-list"><span><i>◫</i>Проєкти<b>{data.projects.length}</b></span><span><i>✓</i>Задачі<b>{data.tasks.length}</b></span><span><i>◷</i>Сесії фокусу<b>{data.sessions.length}</b></span></div><BackupManager refresh={refresh} syncing={syncing} /></article><article><span className="eyebrow">Безпека</span><h2>Приватний простір</h2><p>Вхід захищений Supabase Auth. Паролі не потрапляють на сервер NOVA й зберігаються лише у вигляді безпечних хешів.</p><div className="security-row"><span>Email і пароль</span><b>Активні</b></div><div className="security-row"><span>Синхронізація</span><b>{account ? "Активна" : "Очікування"}</b></div><button className="signout" type="button" onClick={signOut}>Вийти з акаунта</button></article></section>
    <BackendActivity />
  </AppFrame>;
}
