"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../lib/supabase";

export type Project = { id: string; name: string; color: string; deadline?: number | null; archived?: boolean; createdAt: number; updatedAt?: number };
export type Task = { id: string; projectId: string; text: string; done: boolean; status?: "todo" | "doing" | "done"; deadline?: number | null; recurrence?: string | null; sortOrder?: number; createdAt: number; updatedAt?: number };
export type Session = { id: string; projectId: string; startedAt: number; durationSeconds: number };
export type CalendarEvent = { id: string; projectId?: string | null; title: string; startsAt: number; durationMinutes: number; recurrence?: string | null; completed?: boolean; createdAt: number; updatedAt?: number };
export type Preferences = { focusMinutes: number; breakMinutes: number; autoPomodoro: boolean; dailyGoalMinutes: number; activeProjectId: string | null; timerMode: "focus" | "break" };
export type NovaData = { projects: Project[]; tasks: Task[]; sessions: Session[]; events: CalendarEvent[]; preferences: Preferences };
export type Account = { displayName: string; email: string };

const emptyData: NovaData = { projects: [], tasks: [], sessions: [], events: [], preferences: { focusMinutes: 25, breakMinutes: 5, autoPomodoro: false, dailyGoalMinutes: 120, activeProjectId: null, timerMode: "focus" } };
const cacheKey = "nova-v3-cache";
const queueKey = "nova-sync-queue";
const updateEvent = "nova-store-updated";

function normalize(value: Partial<NovaData>): NovaData {
  return { projects: value.projects ?? [], tasks: value.tasks ?? [], sessions: value.sessions ?? [], events: value.events ?? [], preferences: { ...emptyData.preferences, ...(value.preferences ?? {}) } };
}

function mergeByUpdated<T extends { id: string; updatedAt?: number; createdAt?: number; startedAt?: number }>(local: T[], remote: T[]) {
  const items = new Map<string,T>();
  [...remote,...local].forEach((item) => { const previous=items.get(item.id); if (!previous || (item.updatedAt ?? item.createdAt ?? item.startedAt ?? 0) >= (previous.updatedAt ?? previous.createdAt ?? previous.startedAt ?? 0)) items.set(item.id,item); });
  return [...items.values()];
}

export function useNovaStore() {
  const [data, setData] = useState<NovaData>(emptyData);
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const revision = useRef(0);

  const fetchRemote = useCallback(async () => {
    const response = await authFetch("/api/sync", { cache: "no-store" });
    if (!response.ok) throw new Error("offline");
    const result = await response.json();
    revision.current = result.revision ?? 0;
    setAccount(result.user);
    const next = normalize(result);
    setData((current) => next.projects.length || next.tasks.length || next.sessions.length || next.events.length ? next : current);
    setLastSyncedAt(Date.now());
    return next;
  }, []);

  const push = useCallback(async (snapshot: NovaData, force = false) => {
    const response = await authFetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, baseRevision: revision.current, force }) });
    if (response.status === 409) {
      const remoteResponse = await authFetch("/api/sync", { cache: "no-store" });
      const remote = await remoteResponse.json();
      revision.current = remote.revision ?? 0;
      const merged: NovaData = { ...snapshot, projects: mergeByUpdated(snapshot.projects,remote.projects??[]), tasks: mergeByUpdated(snapshot.tasks,remote.tasks??[]), events: mergeByUpdated(snapshot.events,remote.events??[]), sessions: mergeByUpdated(snapshot.sessions,remote.sessions??[]) };
      setData(merged); localStorage.setItem(cacheKey,JSON.stringify(merged));
      return push(merged,true);
    }
    if (!response.ok) throw new Error("sync");
    const result=await response.json(); revision.current=result.revision ?? revision.current+1;
    setLastSyncedAt(result.syncedAt ?? Date.now()); localStorage.removeItem(queueKey);
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey) ?? localStorage.getItem("nova-v2-cache");
    if (cached) { try { setData(normalize(JSON.parse(cached))); } catch { /* optional cache */ } }
    fetchRemote().catch(() => undefined).finally(() => setReady(true));
    const flush = () => { const queued=localStorage.getItem(queueKey); if (queued) { try { push(normalize(JSON.parse(queued))).catch(()=>undefined); } catch { /* invalid queue */ } } };
    const receive=(event:Event)=>{const next=(event as CustomEvent<NovaData>).detail;if(next)setData(normalize(next))};
    window.addEventListener("online",flush);window.addEventListener(updateEvent,receive);return () => {window.removeEventListener("online",flush);window.removeEventListener(updateEvent,receive)};
  }, [fetchRemote,push]);

  const save = useCallback(async (next: NovaData) => {
    setData(next); localStorage.setItem(cacheKey,JSON.stringify(next)); localStorage.setItem(queueKey,JSON.stringify(next)); window.dispatchEvent(new CustomEvent(updateEvent,{detail:next})); setSyncing(true);
    try { await push(next); } catch { /* queued for reconnect */ } finally { setSyncing(false); }
  }, [push]);

  return { data, account, ready, syncing, lastSyncedAt, save, refresh: fetchRemote };
}
