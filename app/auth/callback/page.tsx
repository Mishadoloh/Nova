"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Підтверджуємо акаунт…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const authError = params.get("error_description") ?? params.get("error");
    const next = params.get("next");
    const finish = async () => {
      if (authError) { setMessage(decodeURIComponent(authError.replace(/\+/g, " "))); return; }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setMessage(error.message); return; }
      }
      const { data } = await supabase.auth.getSession();
      const recovery = params.get("type") === "recovery";
      const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
      if (data.session) window.location.replace(recovery ? "/register?recovery=1" : safeNext ?? "/register?complete=1");
      else setMessage("Посилання недійсне або вже використане.");
    };
    finish();
  }, []);
  return <main className="auth-loading"><span>N</span><p>{message}</p><a href="/register">Повернутися до входу</a></main>;
}
