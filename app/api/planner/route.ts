import {
  apiContext,
  apiError,
  apiOk,
  bumpRevision,
  jsonBody,
  recordActivity,
  unauthorized,
} from "../backend";
import { asIdentifier, asInteger, isRecord, MAX_TIMESTAMP } from "../core/validation";

type BusyEvent = {
  startsAt: number;
  durationMinutes: number;
};

type OpenTask = {
  id: string;
  projectId: string;
  text: string;
  deadline: number | null;
  sortOrder: number;
  projectName: string;
  color: string;
};

type Slot = {
  startsAt: number;
  endsAt: number;
  durationMinutes: number;
};

function dayStart(value: number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function minutesFromDayStart(timestamp: number, start: number) {
  return Math.round((timestamp - start) / 60_000);
}

function buildSlots(
  date: number,
  events: BusyEvent[],
  workStartHour: number,
  workEndHour: number,
  focusMinutes: number,
  breakMinutes: number,
) {
  const start = dayStart(date);
  const workStart = workStartHour * 60;
  const workEnd = workEndHour * 60;
  const busy = events
    .map((event) => ({
      from: Math.max(workStart, minutesFromDayStart(event.startsAt, start)),
      to: Math.min(workEnd, minutesFromDayStart(event.startsAt, start) + event.durationMinutes),
    }))
    .filter((event) => event.to > workStart && event.from < workEnd)
    .sort((a, b) => a.from - b.from);
  const merged: Array<{ from: number; to: number }> = [];
  for (const event of busy) {
    const previous = merged.at(-1);
    if (previous && event.from <= previous.to) previous.to = Math.max(previous.to, event.to);
    else merged.push({ ...event });
  }
  const free: Array<{ from: number; to: number }> = [];
  let cursor = workStart;
  for (const event of merged) {
    if (event.from > cursor) free.push({ from: cursor, to: event.from });
    cursor = Math.max(cursor, event.to);
  }
  if (cursor < workEnd) free.push({ from: cursor, to: workEnd });
  const slots: Slot[] = [];
  for (const window of free) {
    let slotStart = window.from;
    while (slotStart + focusMinutes <= window.to) {
      const startsAt = start + slotStart * 60_000;
      slots.push({ startsAt, endsAt: startsAt + focusMinutes * 60_000, durationMinutes: focusMinutes });
      slotStart += focusMinutes + breakMinutes;
    }
  }
  return slots;
}

async function plannerData(
  context: NonNullable<Awaited<ReturnType<typeof apiContext>>>,
  date: number,
  workStartHour: number,
  workEndHour: number,
  focusMinutes: number,
  breakMinutes: number,
) {
  const start = dayStart(date);
  const end = start + 86_400_000 - 1;
  const [eventResult, taskResult] = await context.db.batch([
    context.db.prepare(
      `SELECT starts_at AS startsAt,duration_minutes AS durationMinutes
      FROM calendar_events
      WHERE user_id=? AND starts_at>=? AND starts_at<=?
      ORDER BY starts_at`,
    ).bind(context.user.userId, start, end),
    context.db.prepare(
      `SELECT
        t.id,
        t.project_id AS projectId,
        t.text,
        t.deadline,
        t.sort_order AS sortOrder,
        p.name AS projectName,
        p.color
      FROM tasks t
      JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id
      WHERE t.user_id=? AND t.done=0 AND p.archived=0
      ORDER BY CASE WHEN t.deadline IS NULL THEN 1 ELSE 0 END,t.deadline,t.sort_order,t.created_at
      LIMIT 30`,
    ).bind(context.user.userId),
  ]);
  const events = eventResult.results as unknown as BusyEvent[];
  const tasks = taskResult.results as unknown as OpenTask[];
  const slots = buildSlots(date, events, workStartHour, workEndHour, focusMinutes, breakMinutes);
  const suggestions = slots.slice(0, tasks.length).map((slot, index) => ({ ...slot, task: tasks[index] }));
  return { date: start, workHours: { start: workStartHour, end: workEndHour }, focusMinutes, breakMinutes, busyEvents: events.length, openTasks: tasks.length, slots, suggestions };
}

function querySettings(request: Request) {
  const url = new URL(request.url);
  return {
    date: asInteger(url.searchParams.get("date") ?? Date.now(), 0, MAX_TIMESTAMP) ?? Date.now(),
    workStartHour: asInteger(url.searchParams.get("workStartHour") ?? 9, 0, 22) ?? 9,
    workEndHour: asInteger(url.searchParams.get("workEndHour") ?? 18, 1, 24) ?? 18,
    focusMinutes: asInteger(url.searchParams.get("focusMinutes") ?? 25, 10, 120) ?? 25,
    breakMinutes: asInteger(url.searchParams.get("breakMinutes") ?? 5, 0, 60) ?? 5,
  };
}

export async function GET(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const settings = querySettings(request);
  if (settings.workStartHour >= settings.workEndHour) return apiError("INVALID_WORK_HOURS", "Початок робочого дня має бути раніше завершення", 422);
  return apiOk(await plannerData(context, settings.date, settings.workStartHour, settings.workEndHour, settings.focusMinutes, settings.breakMinutes));
}

export async function POST(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const body = await jsonBody(request);
  if (!body || !isRecord(body)) return apiError("INVALID_JSON", "Некоректний JSON", 400);
  const date = asInteger(body.date ?? Date.now(), 0, MAX_TIMESTAMP) ?? Date.now();
  const workStartHour = asInteger(body.workStartHour ?? 9, 0, 22) ?? 9;
  const workEndHour = asInteger(body.workEndHour ?? 18, 1, 24) ?? 18;
  const focusMinutes = asInteger(body.focusMinutes ?? 25, 10, 120) ?? 25;
  const breakMinutes = asInteger(body.breakMinutes ?? 5, 0, 60) ?? 5;
  const requestedIds = Array.isArray(body.taskIds) ? body.taskIds.map(asIdentifier).filter((id): id is string => Boolean(id)).slice(0, 12) : [];
  if (!requestedIds.length) return apiError("TASKS_REQUIRED", "Обери хоча б одну задачу", 422);
  if (new Set(requestedIds).size !== requestedIds.length) return apiError("DUPLICATE_TASKS", "Задачі не мають повторюватися", 422);
  if (workStartHour >= workEndHour) return apiError("INVALID_WORK_HOURS", "Некоректні робочі години", 422);
  const plan = await plannerData(context, date, workStartHour, workEndHour, focusMinutes, breakMinutes);
  if (plan.slots.length < requestedIds.length) return apiError("NOT_ENOUGH_TIME", "У вибраному дні недостатньо вільних вікон", 409, { availableSlots: plan.slots.length, requestedTasks: requestedIds.length });
  const placeholders = requestedIds.map(() => "?").join(",");
  const taskResult = await context.db.prepare(
    `SELECT id,project_id AS projectId,text
    FROM tasks
    WHERE user_id=? AND done=0 AND id IN (${placeholders})`,
  ).bind(context.user.userId, ...requestedIds).all<{ id: string; projectId: string; text: string }>();
  if (taskResult.results.length !== requestedIds.length) return apiError("TASK_NOT_FOUND", "Одну із задач не знайдено", 404);
  const tasks = new Map(taskResult.results.map((task) => [task.id, task]));
  const timestamp = Date.now();
  const events = requestedIds.map((taskId, index) => {
    const task = tasks.get(taskId)!;
    const slot = plan.slots[index];
    return { id: crypto.randomUUID(), projectId: task.projectId, title: task.text, startsAt: slot.startsAt, durationMinutes: focusMinutes, recurrence: null, completed: false, createdAt: timestamp, updatedAt: timestamp };
  });
  await context.db.batch(events.map((event) => context.db.prepare(
    `INSERT INTO calendar_events
      (id,user_id,project_id,title,starts_at,duration_minutes,recurrence,completed,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).bind(event.id, context.user.userId, event.projectId, event.title, event.startsAt, event.durationMinutes, null, 0, timestamp, timestamp)));
  const sync = await bumpRevision(context.db, context.user.userId);
  await recordActivity(context.db, context.user.userId, { action: "planned", entityType: "calendar", label: `Автоматично заплановано ${events.length} задач`, metadata: { date: dayStart(date), focusMinutes, revision: sync.revision } });
  return apiOk({ events, sync, created: events.length }, 201);
}
