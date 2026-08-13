"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Підтверджуємо акаунт…");
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    const finish = async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setMessage(error.message); return; }
      }
      const { data } = await supabase.auth.getSession();
      const recovery = new URLSearchParams(window.location.search).get("type") === "recovery";
      if (data.session) window.location.replace(recovery ? "/register?recovery=1" : "/register?complete=1");
      else setMessage("Посилання недійсне або вже використане.");
    };
    finish();
  }, []);
  return <main className="auth-loading"><span>N</span><p>{message}</p><a href="/register">Повернутися до входу</a></main>;
}
