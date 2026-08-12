"use client";

import { FormEvent, useEffect, useState } from "react";

type Identity = { displayName: string; email: string } | null;

export function RegistrationForm({ identity }: { identity: Identity }) {
  const [name, setName] = useState(identity?.displayName?.includes("@") ? "" : identity?.displayName ?? "");
  const [area, setArea] = useState("work");
  const [goal, setGoal] = useState(120);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!identity) return;
    fetch("/api/profile", { cache: "no-store" }).then((response) => response.json()).then((result) => {
      const profile = result?.data?.profile;
      if (profile?.displayName) setName(profile.displayName);
      if (profile?.focusArea) setArea(profile.focusArea);
    }).catch(() => undefined);
  }, [identity]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, focusArea: area, dailyGoalMinutes: goal, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv" }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(result?.error?.message ?? "Не вдалося створити профіль");
      setSaving(false);
      return;
    }
    window.location.href = "/account?registered=1";
  };

  if (!identity) return <main className="registration-page"><section className="registration-shell registration-signin"><a className="registration-brand" href="/"><span>N</span>NOVA</a><span className="eyebrow">Захищений вхід</span><h1>Створи свій<br/><em>простір фокусу.</em></h1><p>Увійди через ChatGPT — без нового пароля. NOVA привʼяже проєкти та статистику лише до твого акаунта.</p><a className="registration-submit" href="/signin-with-chatgpt?return_to=%2Fregister">Продовжити через ChatGPT →</a><small>Безпечна авторизація · синхронізація між пристроями</small></section></main>;

  return <main className="registration-page"><section className="registration-shell"><header><a className="registration-brand" href="/"><span>N</span>NOVA</a><div><i/><span>{identity.email}</span></div></header><div className="registration-layout"><div className="registration-copy"><span className="eyebrow">Профіль NOVA</span><h1>Налаштуй<br/><em>власний ритм.</em></h1><p>Три короткі кроки — і твій простір готовий до першої фокус-сесії.</p><ol><li className="active"><b>01</b>Профіль</li><li><b>02</b>Напрям</li><li><b>03</b>Денна ціль</li></ol></div><form onSubmit={submit}><label><span>Як до тебе звертатися?</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder="Твоє імʼя" autoComplete="name"/></label><fieldset><legend>Головний напрям</legend>{[["work","Робота","Великі справи"],["study","Навчання","Нові знання"],["personal","Особисте","Власні цілі"]].map(([value,title,caption])=><button type="button" className={area===value?"active":""} onClick={()=>setArea(value)} key={value}><i/ ><span>{title}<small>{caption}</small></span></button>)}</fieldset><label className="registration-goal"><span>Денна ціль <b>{goal} хв</b></span><input type="range" min="30" max="360" step="15" value={goal} onChange={(event)=>setGoal(Number(event.target.value))}/><small><i>30 хв</i><i>6 год</i></small></label>{message&&<p className="registration-error">{message}</p>}<button className="registration-submit" type="submit" disabled={saving}>{saving?"Створюю профіль…":"Створити профіль →"}</button><small className="registration-terms">Продовжуючи, ти погоджуєшся з приватним збереженням даних фокусу.</small></form></div></section></main>;
}
