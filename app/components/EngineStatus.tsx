"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Service = { ok: boolean; service: string; version?: string };
type Status = {
  mode: "docker" | "embedded";
  label: string;
  ok: boolean;
  services: Record<string, Service>;
};

const serviceNames: Record<string, string> = {
  gateway: "Go API",
  analytics: "Python-аналітика",
  timer: "C++ таймер",
  web: "NOVA Core",
};

export function EngineStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const checkServices = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setChecking(true);
    try {
      const response = await fetch("/api/engine/health", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Health check failed");
      const payload = await response.json();
      setStatus(payload.data as Status);
      setCheckedAt(new Date());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus({
        mode: "embedded",
        label: "Вбудований рушій",
        ok: true,
        services: { web: { ok: true, service: "nova-embedded", version: "1.0.0" } },
      });
      setCheckedAt(new Date());
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void checkServices(), 0);
    const interval = window.setInterval(() => void checkServices(), 45_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      requestRef.current?.abort();
    };
  }, [checkServices]);

  const services = Object.entries(status?.services ?? {});
  const online = services.filter(([, service]) => service.ok).length;
  const mode = checking && !status ? "checking" : (status?.mode ?? "embedded");

  return (
    <div className="engine-status-wrap">
      <button type="button" className={`engine-status ${mode}`} aria-expanded={expanded} aria-controls="engine-status-panel" onClick={() => setExpanded((value) => !value)}>
        <i aria-hidden="true" />
        <span>{checking ? "Оновлення сервісів" : (status?.label ?? "NOVA Core")}</span>
        <small>{checking ? "sync" : status?.mode === "docker" ? `${online}/${services.length} online` : "резерв активний"}</small>
        <b aria-hidden="true">{expanded ? "−" : "+"}</b>
      </button>

      {expanded ? (
        <div id="engine-status-panel" className="engine-status-panel">
          <div className="engine-status-heading">
            <div><span>Системний стан</span><strong>{status?.mode === "docker" ? "Повний стек активний" : "Безперервна робота"}</strong></div>
            <button type="button" onClick={() => void checkServices()} disabled={checking} aria-label="Перевірити сервіси ще раз">
              {checking ? "Перевіряю…" : "Оновити"}
            </button>
          </div>
          <ul>
            {services.map(([key, service]) => (
              <li key={key}><i className={service.ok ? "online" : "offline"} /><span>{serviceNames[key] ?? service.service}</span><small>{service.version ? `v${service.version}` : "online"}</small></li>
            ))}
          </ul>
          <p>{status?.mode === "docker" ? "Go маршрутизує запити, Python рахує аналітику, C++ керує планом таймера." : "Хмарні сервіси недоступні або не підключені — NOVA автоматично використовує вбудований рушій без втрати функцій."}</p>
          <time dateTime={checkedAt?.toISOString()}>{checkedAt ? `Перевірено о ${checkedAt.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}` : "Перевірка запускається"}</time>
        </div>
      ) : null}
    </div>
  );
}
