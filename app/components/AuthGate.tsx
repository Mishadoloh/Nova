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

  if (!ready) return <main className="auth-loading"><span>N</span><p>Перевіряємо сесію…</p></main>;
  return children;
}
