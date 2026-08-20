import { apiContext, apiError, apiOk, cleanNumber, unauthorized } from "../backend";
import type {
  DailyInsight,
  HourInsight,
  InsightPayload,
  InsightSummary,
  ProjectInsight,
  WeekdayInsight,
} from "../core/contracts";

type SummaryRow = {
  sessions: number;
  minutes: number;
  averageMinutes: number;
  longestMinutes: number;
  activeDays: number;
};

type TaskSummaryRow = {
  completedTasks: number;
  openTasks: number;
};

type ProjectRow = {
  projectId: string;
  name: string;
  color: string;
  sessions: number;
  minutes: number;
};

function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function dateKey(timestamp: number, timezoneOffsetMinutes: number) {
  return new Date(timestamp - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

function calculateStreak(dates: string[], now: number, timezoneOffsetMinutes: number) {
  const unique = new Set(dates);
  const cursor = new Date(now - timezoneOffsetMinutes * 60_000);
  cursor.setUTCHours(0, 0, 0, 0);
  let streak = 0;
  const today = cursor.toISOString().slice(0, 10);
  if (!unique.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (let index = 0; index < 366; index += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (!unique.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function focusScore(summary: Pick<InsightSummary, "totalMinutes" | "activeDays" | "sessions" | "completedTasks" | "openTasks" | "streakDays">, periodDays: number) {
  const consistency = Math.min(35, Math.round(summary.activeDays / Math.max(1, periodDays) * 35));
  const volume = Math.min(30, Math.round(summary.totalMinutes / Math.max(1, periodDays * 25) * 30));
  const sessionQuality = Math.min(15, Math.round(summary.totalMinutes / Math.max(1, summary.sessions * 25) * 15));
  const completion = Math.min(10, Math.round(summary.completedTasks / Math.max(1, summary.completedTasks + summary.openTasks) * 10));
  const streak = Math.min(10, summary.streakDays * 2);
  return Math.min(100, consistency + volume + sessionQuality + completion + streak);
}

function recommendation(summary: InsightSummary) {
  if (!summary.sessions) return "Заверши першу фокус-сесію — NOVA побудує персональний ритм.";
  if (summary.activeDays < Math.ceil(summary.periodDays / 4)) return "Спробуй коротку сесію завтра: регулярність зараз дасть більший ефект, ніж тривалі марафони.";
  if (summary.changePercent < -15) return "Темп знизився. Заплануй одну 25-хвилинну сесію у свій найсильніший час.";
  if (summary.completionRate < 35 && summary.openTasks > 3) return "У списку накопичились задачі. Обери одну найменшу й заверши її у наступному фокус-блоці.";
  if (summary.bestHour !== null) return `Твій найсильніший час — близько ${String(summary.bestHour).padStart(2, "0")}:00. Захисти це вікно для складної роботи.`;
  return "Тримай поточний ритм і залишай невелику паузу між глибокими сесіями.";
}

export async function GET(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const url = new URL(request.url);
  const periodDays = Math.round(cleanNumber(url.searchParams.get("days") ?? 14, 7, 90) ?? 14);
  const timezoneOffsetMinutes = Math.round(cleanNumber(url.searchParams.get("timezoneOffsetMinutes") ?? 0, -840, 840) ?? 0);
  const now = Date.now();
  const periodMs = periodDays * 86_400_000;
  const from = now - periodMs;
  const previousFrom = from - periodMs;
  if (periodDays < 7 || periodDays > 90) return apiError("INVALID_PERIOD", "Період має бути від 7 до 90 днів", 422);

  const [currentResult, previousResult, dailyResult, hourlyResult, weekdayResult, projectResult, taskResult, dateResult] = await context.db.batch([
    context.db.prepare(
      `SELECT
        COUNT(*) AS sessions,
        COALESCE(ROUND(SUM(duration_seconds)/60.0),0) AS minutes,
        COALESCE(ROUND(AVG(duration_seconds)/60.0),0) AS averageMinutes,
        COALESCE(ROUND(MAX(duration_seconds)/60.0),0) AS longestMinutes,
        COUNT(DISTINCT strftime('%Y-%m-%d',(started_at-?*60000)/1000,'unixepoch')) AS activeDays
      FROM focus_sessions
      WHERE user_id=? AND started_at>=? AND started_at<=?`,
    ).bind(timezoneOffsetMinutes, context.user.userId, from, now),
    context.db.prepare(
      `SELECT COALESCE(ROUND(SUM(duration_seconds)/60.0),0) AS minutes
      FROM focus_sessions
      WHERE user_id=? AND started_at>=? AND started_at<?`,
    ).bind(context.user.userId, previousFrom, from),
    context.db.prepare(
      `SELECT
        strftime('%Y-%m-%d',(started_at-?*60000)/1000,'unixepoch') AS date,
        COUNT(*) AS sessions,
        ROUND(SUM(duration_seconds)/60.0) AS minutes
      FROM focus_sessions
      WHERE user_id=? AND started_at>=? AND started_at<=?
      GROUP BY date
      ORDER BY date`,
    ).bind(timezoneOffsetMinutes, context.user.userId, from, now),
    context.db.prepare(
      `SELECT
        CAST(strftime('%H',(started_at-?*60000)/1000,'unixepoch') AS INTEGER) AS hour,
        COUNT(*) AS sessions,
        ROUND(SUM(duration_seconds)/60.0) AS minutes
      FROM focus_sessions
      WHERE user_id=? AND started_at>=? AND started_at<=?
      GROUP BY hour
      ORDER BY hour`,
    ).bind(timezoneOffsetMinutes, context.user.userId, from, now),
    context.db.prepare(
      `SELECT
        CAST(strftime('%w',(started_at-?*60000)/1000,'unixepoch') AS INTEGER) AS weekday,
        COUNT(*) AS sessions,
        ROUND(SUM(duration_seconds)/60.0) AS minutes
      FROM focus_sessions
      WHERE user_id=? AND started_at>=? AND started_at<=?
      GROUP BY weekday
      ORDER BY weekday`,
    ).bind(timezoneOffsetMinutes, context.user.userId, from, now),
    context.db.prepare(
      `SELECT
        p.id AS projectId,
        p.name,
        p.color,
        COUNT(s.id) AS sessions,
        COALESCE(ROUND(SUM(s.duration_seconds)/60.0),0) AS minutes
      FROM projects p
      LEFT JOIN focus_sessions s
        ON s.project_id=p.id AND s.user_id=p.user_id AND s.started_at>=? AND s.started_at<=?
      WHERE p.user_id=?
      GROUP BY p.id,p.name,p.color
      HAVING sessions>0
      ORDER BY minutes DESC`,
    ).bind(from, now, context.user.userId),
    context.db.prepare(
      `SELECT
        SUM(CASE WHEN done=1 THEN 1 ELSE 0 END) AS completedTasks,
        SUM(CASE WHEN done=0 THEN 1 ELSE 0 END) AS openTasks
      FROM tasks
      WHERE user_id=?`,
    ).bind(context.user.userId),
    context.db.prepare(
      `SELECT started_at AS startedAt
      FROM focus_sessions
      WHERE user_id=? AND started_at>=?
      ORDER BY started_at DESC`,
    ).bind(context.user.userId, now - 366 * 86_400_000),
  ]);

  const current = (currentResult.results[0] ?? {}) as unknown as SummaryRow;
  const previousMinutes = number(previousResult.results[0]?.minutes);
  const totalMinutes = number(current.minutes);
  const tasks = (taskResult.results[0] ?? {}) as unknown as TaskSummaryRow;
  const completedTasks = number(tasks.completedTasks);
  const openTasks = number(tasks.openTasks);
  const daily = dailyResult.results.map((row) => ({ date: String(row.date), sessions: number(row.sessions), minutes: number(row.minutes) })) as DailyInsight[];
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const row = hourlyResult.results.find((item) => number(item.hour) === hour);
    return { hour, sessions: number(row?.sessions), minutes: number(row?.minutes) };
  }) as HourInsight[];
  const weekdays = Array.from({ length: 7 }, (_, weekday) => {
    const row = weekdayResult.results.find((item) => number(item.weekday) === weekday);
    return { weekday, sessions: number(row?.sessions), minutes: number(row?.minutes) };
  }) as WeekdayInsight[];
  const dates = dateResult.results.map((row) => dateKey(number(row.startedAt), timezoneOffsetMinutes));
  const streakDays = calculateStreak(dates, now, timezoneOffsetMinutes);
  const bestHourRow = [...hourly].sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions)[0];
  const bestWeekdayRow = [...weekdays].sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions)[0];
  const sessions = number(current.sessions);
  const activeDays = number(current.activeDays);
  const changePercent = previousMinutes ? Math.round((totalMinutes - previousMinutes) / previousMinutes * 100) : totalMinutes ? 100 : 0;
  const completionRate = Math.round(completedTasks / Math.max(1, completedTasks + openTasks) * 100);
  const summaryBase = { totalMinutes, activeDays, sessions, completedTasks, openTasks, streakDays };
  const summary: InsightSummary = {
    periodDays,
    generatedAt: now,
    totalMinutes,
    previousMinutes,
    changePercent,
    sessions,
    averageMinutes: number(current.averageMinutes),
    longestMinutes: number(current.longestMinutes),
    completedTasks,
    openTasks,
    completionRate,
    activeDays,
    streakDays,
    bestHour: bestHourRow?.minutes ? bestHourRow.hour : null,
    bestWeekday: bestWeekdayRow?.minutes ? bestWeekdayRow.weekday : null,
    focusScore: focusScore(summaryBase, periodDays),
  };
  const projectRows = projectResult.results as unknown as ProjectRow[];
  const projects = projectRows.map((project) => ({
    ...project,
    sessions: number(project.sessions),
    minutes: number(project.minutes),
    percent: Math.round(number(project.minutes) / Math.max(1, totalMinutes) * 1000) / 10,
  })) as ProjectInsight[];
  const payload: InsightPayload = { summary, daily, hourly, weekdays, projects, recommendation: recommendation(summary) };
  return apiOk(payload);
}
