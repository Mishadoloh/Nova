"use client";

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://tmpnjzuqrwzctmbycagb.supabase.co",
  "sb_publishable_71xrJ-OJLglYBxSmiIfpsA_Ly2tYZaV",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}
