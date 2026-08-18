"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type CallbackState = {
  status: "loading" | "error";
  title: string;
  message: string;
};

const initialState: CallbackState = {
  status: "loading",
  title: "Завершуємо вхід",
  message: "Захищено підтверджуємо твій акаунт…",
};

function friendlyAuthError(rawError: string) {
  let decoded = rawError;
  try {
    decoded = decodeURIComponent(rawError.replace(/\+/g, " "));
  } catch {
    decoded = rawError;
  }

  const normalized = decoded.toLowerCase();
  if (
    normalized.includes("access_denied") ||
    normalized.includes("cancel") ||
    normalized.includes("denied")
  ) {
    return {
      title: "Вхід скасовано",
      message: "Акаунт не змінено. Можеш безпечно спробувати ще раз.",
    };
  }
  if (
    normalized.includes("expired") ||
    normalized.includes("session") ||
    normalized.includes("exchange")
  ) {
    return {
      title: "Сесія завершилась",
      message: "Час підтвердження минув. Запусти вхід через Google ще раз.",
    };
  }
  return {
    title: "Не вдалося увійти",
    message: "Google не завершив авторизацію. Спробуй ще раз за кілька секунд.",
  };
}

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>(initialState);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const authError = params.get("error_description") ?? params.get("error");
    const next = params.get("next");
    const safeNext =
      next?.startsWith("/") && !next.startsWith("//") ? next : null;

    const showError = (error: string) => {
      if (!active) return;
      setState({ status: "error", ...friendlyAuthError(error) });
    };

    const finish = async () => {
      if (authError) {
        showError(authError);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          showError(error.message);
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        showError(error.message);
        return;
      }

      const recovery = params.get("type") === "recovery";
      if (data.session) {
        window.location.replace(
          recovery
            ? "/register?recovery=1"
            : (safeNext ?? "/register?complete=1"),
        );
        return;
      }

      showError("session expired");
    };

    void finish();
    return () => {
      active = false;
    };
  }, []);

  const isLoading = state.status === "loading";

  return (
    <main className="auth-result-page">
      <section
        className="auth-result-card"
        data-status={state.status}
        aria-busy={isLoading}
      >
        <a
          className="auth-result-brand"
          href="/"
          aria-label="NOVA — на головну"
        >
          <span>N</span>
          NOVA
        </a>

        <div className="auth-result-symbol" aria-hidden="true">
          {isLoading ? <i /> : "!"}
        </div>

        <span className="eyebrow">
          {isLoading ? "Безпечна авторизація" : "Потрібна твоя дія"}
        </span>
        <h1>{state.title}</h1>
        <p role={isLoading ? "status" : "alert"}>{state.message}</p>

        {!isLoading && (
          <div className="auth-result-actions">
            <a className="auth-result-primary" href="/register">
              Спробувати ще раз →
            </a>
            <a className="auth-result-secondary" href="/">
              На головну
            </a>
          </div>
        )}

        <small>Твої дані залишаються захищеними</small>
      </section>
    </main>
  );
}
