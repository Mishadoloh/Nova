import { apiError, apiOk, cleanNumber, jsonBody } from "../../backend";
import {
  analyticsSummary,
  type FocusSessionInput,
  type ProjectInput,
} from "../../../lib/polyglot";

export async function POST(request: Request) {
  const body = await jsonBody(request, 2_000_000);
  if (!body) return apiError("INVALID_JSON", "Некоректні дані аналітики");
  if (!Array.isArray(body.sessions) || !Array.isArray(body.projects)) {
    return apiError("VALIDATION_ERROR", "Очікуються сесії та проєкти", 422);
  }
  if (body.sessions.length > 10_000 || body.projects.length > 1_000) {
    return apiError(
      "PAYLOAD_TOO_LARGE",
      "Забагато записів для одного запиту",
      413,
    );
  }
  const sessions = body.sessions.flatMap((raw): FocusSessionInput[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? "").slice(0, 120);
    const projectId = String(item.projectId ?? "").slice(0, 120);
    const startedAt = cleanNumber(item.startedAt, 0, Date.now() + 86_400_000);
    const durationSeconds = cleanNumber(item.durationSeconds, 1, 43_200);
    return id && projectId && startedAt !== null && durationSeconds !== null
      ? [{ id, projectId, startedAt, durationSeconds }]
      : [];
  });
  const projects = body.projects.flatMap((raw): ProjectInput[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? "").slice(0, 120);
    const name = String(item.name ?? "")
      .trim()
      .slice(0, 120);
    const color = String(item.color ?? "#dfff00").slice(0, 32);
    return id && name ? [{ id, name, color }] : [];
  });
  return apiOk(
    await analyticsSummary({
      sessions,
      projects,
      timezoneOffsetMinutes:
        cleanNumber(body.timezoneOffsetMinutes ?? 0, -840, 840) ?? 0,
      periodDays: cleanNumber(body.periodDays ?? 14, 1, 366) ?? 14,
      now:
        cleanNumber(body.now ?? Date.now(), 0, Date.now() + 86_400_000) ??
        Date.now(),
    }),
  );
}
