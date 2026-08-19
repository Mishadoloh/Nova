import { apiError, apiOk, cleanNumber, jsonBody } from "../../backend";
import { timerPlan } from "../../../lib/polyglot";

export async function POST(request: Request) {
  const body = await jsonBody(request, 32_000);
  if (!body) return apiError("INVALID_JSON", "Некоректні дані таймера");
  const focusMinutes = cleanNumber(body.focusMinutes, 1, 120);
  const breakMinutes = cleanNumber(body.breakMinutes, 1, 60);
  if (focusMinutes === null || breakMinutes === null) {
    return apiError(
      "VALIDATION_ERROR",
      "Перевір тривалість фокусу й перерви",
      422,
    );
  }
  return apiOk(
    await timerPlan({
      focusMinutes,
      breakMinutes,
      longBreakMinutes: cleanNumber(body.longBreakMinutes ?? 15, 5, 90) ?? 15,
      cycles: cleanNumber(body.cycles ?? 4, 1, 12) ?? 4,
      autoStart: Boolean(body.autoStart),
    }),
  );
}
