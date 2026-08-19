"use client";

import { useEffect, useState } from "react";

type Status = {
  mode: "docker" | "embedded";
  label: string;
  ok: boolean;
};

export function EngineStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/engine/health", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload) => setStatus(payload.data as Status))
      .catch(() =>
        setStatus({ mode: "embedded", label: "Вбудований рушій", ok: true }),
      );
    return () => controller.abort();
  }, []);

  return (
    <div
      className={`engine-status ${status?.mode ?? "checking"}`}
      title={
        status?.mode === "docker"
          ? "Go API, Python-аналітика та C++ таймер працюють"
          : "NOVA працює у резервному вбудованому режимі"
      }
    >
      <i />
      <span>{status?.label ?? "Перевірка сервісів"}</span>
      <small>{status?.mode === "docker" ? "3/3 online" : "без простою"}</small>
    </div>
  );
}
