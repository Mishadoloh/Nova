import { env } from "cloudflare:workers";

type RuntimeEnv = {
  NOVA_SERVICES_URL?: string;
  NOVA_SERVICES_TOKEN?: string;
};

export type EngineMode = "docker" | "embedded";

export type FocusSessionInput = {
  id: string;
  projectId: string;
  startedAt: number;
  durationSeconds: number;
};

export type ProjectInput = {
  id: string;
  name: string;
  color: string;
};

const runtime = env as typeof env & RuntimeEnv;

function serviceConfig() {
  const baseURL = runtime.NOVA_SERVICES_URL?.trim().replace(/\/$/, "");
  const token = runtime.NOVA_SERVICES_TOKEN?.trim();
  return baseURL && token ? { baseURL, token } : null;
}

async function callService<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const config = serviceConfig();
  if (!config) return null;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${config.token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${config.baseURL}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(4_000),
      });
      if (response.ok) return (await response.json()) as T;
      if (![502, 503, 504].includes(response.status)) return null;
    } catch {
      // One retry absorbs container wake-ups and brief network gaps.
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
  }
  return null;
}

export async function engineHealth() {
  const response = await callService<{
    ok: boolean;
    services: Record<
      string,
      { ok: boolean; service: string; version?: string }
    >;
  }>("/health");
  if (response?.ok) {
    return {
      mode: "docker" as EngineMode,
      ok: true,
      services: response.services,
      label: "Go · Python · C++",
    };
  }
  return {
    mode: "embedded" as EngineMode,
    ok: true,
    services: {
      web: { ok: true, service: "nova-embedded", version: "1.0.0" },
    },
    label: "Вбудований рушій",
  };
}

export type TimerPlanInput = {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes?: number;
  cycles?: number;
  autoStart?: boolean;
};

export async function timerPlan(input: TimerPlanInput) {
  const normalized = {
    focusMinutes: Math.min(120, Math.max(1, Math.round(input.focusMinutes))),
    breakMinutes: Math.min(60, Math.max(1, Math.round(input.breakMinutes))),
    longBreakMinutes: Math.min(
      90,
      Math.max(5, Math.round(input.longBreakMinutes ?? 15)),
    ),
    cycles: Math.min(12, Math.max(1, Math.round(input.cycles ?? 4))),
    autoStart: Boolean(input.autoStart),
  };
  const remote = await callService<{
    ok: boolean;
    data: {
      planId: string;
      totalSeconds: number;
      focusSessions: number;
      phases: Array<{
        kind: string;
        cycle: number;
        durationSeconds: number;
        autoStart: boolean;
      }>;
    };
  }>("/v1/timer/plan", {
    method: "POST",
    body: JSON.stringify(normalized),
  });
  if (remote?.ok) return { mode: "docker" as EngineMode, ...remote.data };

  const phases = Array.from({ length: normalized.cycles }, (_, index) => {
    const cycle = index + 1;
    return [
      {
        kind: "focus",
        cycle,
        durationSeconds: normalized.focusMinutes * 60,
        autoStart: cycle > 1 && normalized.autoStart,
      },
      {
        kind: cycle === normalized.cycles ? "long_break" : "short_break",
        cycle,
        durationSeconds:
          (cycle === normalized.cycles
            ? normalized.longBreakMinutes
            : normalized.breakMinutes) * 60,
        autoStart: normalized.autoStart,
      },
    ];
  }).flat();
  return {
    mode: "embedded" as EngineMode,
    planId: `embedded-${normalized.focusMinutes}-${normalized.breakMinutes}-${normalized.cycles}`,
    totalSeconds: phases.reduce((sum, phase) => sum + phase.durationSeconds, 0),
    focusSessions: normalized.cycles,
    phases,
  };
}

export type AnalyticsInput = {
  sessions: FocusSessionInput[];
  projects: ProjectInput[];
  timezoneOffsetMinutes: number;
  periodDays: number;
  now?: number;
};

export async function analyticsSummary(input: AnalyticsInput) {
  const remote = await callService<{
    ok: boolean;
    data: AnalyticsResult;
  }>("/v1/analytics/summary", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (remote?.ok) return { mode: "docker" as EngineMode, ...remote.data };
  return { mode: "embedded" as EngineMode, ...embeddedAnalytics(input) };
}

export type AnalyticsResult = {
  totalMinutes: number;
  averageMinutes: number;
  longestMinutes: number;
  sessionCount: number;
  bestHour: number | null;
  activeDays: number;
  streakDays: number;
  focusScore: number;
  changePercent: number;
  projectShares: Array<{
    projectId: string;
    name: string;
    color: string;
    minutes: number;
    percent: number;
  }>;
  recommendation: string;
};

function embeddedAnalytics(input: AnalyticsInput): AnalyticsResult {
  const now = input.now ?? Date.now();
  const span = input.periodDays * 86_400_000;
  const current = input.sessions.filter(
    (item) => item.startedAt >= now - span && item.startedAt <= now,
  );
  const previous = input.sessions.filter(
    (item) => item.startedAt >= now - span * 2 && item.startedAt < now - span,
  );
  const minutes = (items: FocusSessionInput[]) =>
    Math.round(items.reduce((sum, item) => sum + item.durationSeconds, 0) / 60);
  const totalMinutes = minutes(current);
  const previousMinutes = minutes(previous);
  const localDate = (timestamp: number) =>
    new Date(timestamp - input.timezoneOffsetMinutes * 60_000);
  const hourCounts = new Map<number, number>();
  current.forEach((item) => {
    const hour = localDate(item.startedAt).getUTCHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  });
  const bestHour =
    [...hourCounts].sort(
      ([hourA, countA], [hourB, countB]) => countB - countA || hourA - hourB,
    )[0]?.[0] ?? null;
  const activeDays = new Set(
    current.map((item) => localDate(item.startedAt).toISOString().slice(0, 10)),
  ).size;
  const focusScore = Math.min(
    100,
    activeDays * 6 +
      Math.round((totalMinutes / Math.max(1, input.periodDays * 25)) * 35) +
      Math.min(
        15,
        Math.round((totalMinutes / Math.max(1, current.length) / 25) * 15),
      ),
  );
  const projects = new Map(input.projects.map((item) => [item.id, item]));
  const totals = new Map<string, number>();
  current.forEach((item) =>
    totals.set(
      item.projectId,
      (totals.get(item.projectId) ?? 0) + item.durationSeconds,
    ),
  );
  const projectShares = [...totals]
    .sort((a, b) => b[1] - a[1])
    .map(([projectId, seconds]) => {
      const project = projects.get(projectId);
      const projectMinutes = Math.round(seconds / 60);
      return {
        projectId,
        name: project?.name ?? "Фокус",
        color: project?.color ?? "#dfff00",
        minutes: projectMinutes,
        percent:
          Math.round((projectMinutes / Math.max(1, totalMinutes)) * 1000) / 10,
      };
    });
  return {
    totalMinutes,
    averageMinutes: current.length
      ? Math.round(totalMinutes / current.length)
      : 0,
    longestMinutes: Math.round(
      Math.max(0, ...current.map((item) => item.durationSeconds)) / 60,
    ),
    sessionCount: current.length,
    bestHour,
    activeDays,
    streakDays: 0,
    focusScore,
    changePercent: previousMinutes
      ? Math.round(((totalMinutes - previousMinutes) / previousMinutes) * 100)
      : totalMinutes
        ? 100
        : 0,
    projectShares,
    recommendation:
      bestHour === null
        ? "Заверши першу фокус-сесію — NOVA знайде твій робочий ритм."
        : `Найкраще вікно починається близько ${String(bestHour).padStart(2, "0")}:00. Заплануй там складну задачу.`,
  };
}
