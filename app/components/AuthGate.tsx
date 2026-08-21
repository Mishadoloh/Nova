"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const publicPaths = new Set(["/register", "/auth/callback"]);

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = publicPaths.has(pathname);
  const [ready, setReady] = useState(isPublic);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session && !isPublic) window.location.replace(`/register?returnTo=${encodeURIComponent(pathname)}`);
      else setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isPublic) window.location.replace("/register");
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [isPublic, pathname]);

  if (!ready) return (
    <main className="auth-loading" aria-live="polite" aria-busy="true">
      <div className="splash-atmosphere" aria-hidden="true">
        <i className="splash-orbit splash-orbit-one" />
        <i className="splash-orbit splash-orbit-two" />
        <i className="splash-orbit splash-orbit-three" />
        <span className="splash-scan" />
      </div>

      <section className="splash-core">
        <div className="splash-brand" aria-label="NOVA">
          <div className="splash-logo">
            <i aria-hidden="true" />
            <span>N</span>
          </div>
          <div className="splash-wordmark">
            <strong>NOVA</strong>
            <small>focus operating system</small>
          </div>
        </div>

        <div className="splash-status">
          <div className="splash-status-head">
            <span>Запуск простору</span>
            <b>01 / 03</b>
          </div>
          <div className="splash-progress" aria-hidden="true"><i /></div>
          <p>Перевіряємо сесію…</p>
        </div>

        <div className="splash-signals" aria-hidden="true">
          <span><i /> auth</span>
          <span><i /> sync</span>
          <span><i /> focus</span>
        </div>
      </section>

      <span className="splash-corner splash-corner-left" aria-hidden="true">N / 2026</span>
      <span className="splash-corner splash-corner-right" aria-hidden="true">менше шуму · більше сенсу</span>
    </main>
  );
  return children;
}
