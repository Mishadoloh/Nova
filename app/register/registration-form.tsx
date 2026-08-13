"use client";

/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, useEffect, useState } from "react";
import { authFetch, supabase } from "../lib/supabase";

type Mode = "signin" | "signup" | "reset" | "password" | "profile";

export function RegistrationForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("work");
  const [goal, setGoal] = useState(120);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (new URLSearchParams(window.location.search).get("recovery") === "1") { setMode("password"); return; }
      setEmail(data.session.user.email ?? "");
      setName(String(data.session.user.user_metadata?.display_name ?? ""));
      setMode("profile");
      authFetch("/api/profile", { cache: "no-store" }).then((response) => response.json()).then((result) => {
        const profile = result?.data?.profile;
        if (profile?.displayName) setName(profile.displayName);
        if (profile?.focusArea) setArea(profile.focusArea);
      }).catch(() => undefined);
    });
  }, []);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setMessage(""); setSuccess(false);
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback` });
      setMessage(error?.message ?? "Лист для відновлення пароля надіслано."); setSuccess(!error); setSaving(false); return;
    }
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) { setMessage(error.message); setSaving(false); return; }
      if (!data.session) { setMessage("Перевір пошту та підтвердь реєстрацію."); setSuccess(true); setSaving(false); return; }
      setMode("profile"); setSaving(false); return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage(error.message === "Invalid login credentials" ? "Невірний email або пароль." : error.message); setSaving(false); return; }
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    window.location.replace(returnTo?.startsWith("/") ? returnTo : "/");
  };

  const continueWithGoogle = async () => {
    setSaving(true);
    setMessage("");
    setSuccess(false);

    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (returnTo?.startsWith("/")) callbackUrl.searchParams.set("next", returnTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setMessage(error.message.includes("provider is not enabled")
        ? "Вхід через Google ще не активований у Supabase."
        : error.message);
      setSaving(false);
      return;
    }

    if (!data.url) {
      setMessage("Не вдалося відкрити Google. Спробуй ще раз.");
      setSaving(false);
    }
  };

  const submitProfile = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage("");
    await supabase.auth.updateUser({ data: { display_name: name } });
    const response = await authFetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, focusArea: area, dailyGoalMinutes: goal, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv" }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) { setMessage(result?.error?.message ?? "Не вдалося зберегти профіль"); setSaving(false); return; }
    window.location.replace("/account?registered=1");
  };

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setMessage(error.message); setSaving(false); return; }
    setSuccess(true); setMessage("Новий пароль збережено."); setSaving(false);
    window.setTimeout(() => window.location.replace("/"), 900);
  };

  if (mode === "password") return <main className="registration-page"><section className="registration-shell registration-signin"><a className="registration-brand" href="/"><span>N</span>NOVA</a><span className="eyebrow">Відновлення доступу</span><h1>Створи новий<br/><em>пароль.</em></h1><p>Використай щонайменше 8 символів. Після збереження NOVA автоматично відкриє твій простір.</p><form className="password-update-form" onSubmit={updatePassword}><label><span>Новий пароль</span><input type="password" value={password} onChange={(event)=>setPassword(event.target.value)} minLength={8} required autoComplete="new-password" placeholder="Мінімум 8 символів"/></label>{message&&<p className={success?"registration-success":"registration-error"}>{message}</p>}<button className="registration-submit" disabled={saving}>{saving?"Зберігаю…":"Зберегти пароль →"}</button></form></section></main>;

  if (mode === "profile") return <main className="registration-page"><section className="registration-shell"><header><a className="registration-brand" href="/"><span>N</span>NOVA</a><div><i/><span>{email}</span></div></header><div className="registration-layout"><div className="registration-copy"><span className="eyebrow">Профіль NOVA</span><h1>Налаштуй<br/><em>власний ритм.</em></h1><p>Три короткі кроки — і твій простір готовий до першої фокус-сесії.</p><ol><li className="active"><b>01</b>Профіль</li><li><b>02</b>Напрям</li><li><b>03</b>Денна ціль</li></ol></div><form onSubmit={submitProfile}><label><span>Як до тебе звертатися?</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder="Твоє імʼя" autoComplete="name"/></label><fieldset><legend>Головний напрям</legend>{[["work","Робота","Великі справи"],["study","Навчання","Нові знання"],["personal","Особисте","Власні цілі"]].map(([value,title,caption])=><button type="button" className={area===value?"active":""} onClick={()=>setArea(value)} key={value}><i/><span>{title}<small>{caption}</small></span></button>)}</fieldset><label className="registration-goal"><span>Денна ціль <b>{goal} хв</b></span><input type="range" min="30" max="360" step="15" value={goal} onChange={(event)=>setGoal(Number(event.target.value))}/><small><i>30 хв</i><i>6 год</i></small></label>{message&&<p className="registration-error">{message}</p>}<button className="registration-submit" type="submit" disabled={saving}>{saving?"Зберігаю…":"Зберегти профіль →"}</button></form></div></section></main>;

  return <main className="registration-page"><section className="registration-shell registration-auth"><div className="registration-auth-side"><a className="registration-brand" href="/"><span>N</span>NOVA</a><span className="eyebrow">Твій фокус-кокпіт</span><h1>Зосередься.<br/><em>Решту памʼятає NOVA.</em></h1><p>Проєкти, таймер, статистика й твій ритм синхронізуються між пристроями.</p><ul><li>✓ Приватний акаунт</li><li>✓ Захищені сесії</li><li>✓ Хмарна синхронізація</li></ul></div><form className="registration-auth-form" onSubmit={submitAuth}><span className="eyebrow">{mode==="signup"?"Новий акаунт":mode==="reset"?"Відновлення":"З поверненням"}</span><h2>{mode==="signup"?"Створити акаунт":mode==="reset"?"Забув пароль?":"Увійти в NOVA"}</h2><p>{mode==="signup"?"Почни будувати власний ритм.":mode==="reset"?"Ми надішлемо безпечне посилання на пошту.":"Продовжуй із того місця, де зупинився."}</p>{mode!=="reset"&&<><button className="google-auth-button" type="button" onClick={continueWithGoogle} disabled={saving} aria-label={mode==="signup"?"Зареєструватися через Google":"Увійти через Google"}><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.39a4.61 4.61 0 0 1-2 3.03v2.54h3.24c1.9-1.75 2.97-4.33 2.97-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.62.39 3.15 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg><span>{mode==="signup"?"Зареєструватися через Google":"Продовжити через Google"}</span><i aria-hidden="true">→</i></button><div className="auth-divider"><span>або через email</span></div></>}{mode==="signup"&&<label><span>Імʼя</span><input value={name} onChange={(event)=>setName(event.target.value)} required autoComplete="name" placeholder="Як до тебе звертатися"/></label>}<label><span>Email</span><input type="email" value={email} onChange={(event)=>setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com"/></label>{mode!=="reset"&&<label><span>Пароль</span><input type="password" value={password} onChange={(event)=>setPassword(event.target.value)} required minLength={8} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder="Мінімум 8 символів"/></label>}{message&&<p className={success?"registration-success":"registration-error"}>{message}</p>}<button className="registration-submit" type="submit" disabled={saving}>{saving?"Зачекай…":mode==="signup"?"Зареєструватися →":mode==="reset"?"Надіслати посилання →":"Увійти →"}</button><div className="auth-switch">{mode==="signin"?<><button type="button" onClick={()=>setMode("reset")}>Забув пароль?</button><button type="button" onClick={()=>setMode("signup")}>Створити акаунт</button></>:<button type="button" onClick={()=>{setMode("signin");setMessage("")}}>← Повернутися до входу</button>}</div></form></section></main>;
}
