import {
  apiContext,
  apiError,
  apiOk,
  bumpRevision,
  cleanId,
  cleanNumber,
  jsonBody,
  recordActivity,
  unauthorized,
} from "../backend";
import type { CalendarEventRecord, CalendarMutation, CalendarQuery } from "../core/contracts";
import { MAX_TIMESTAMP, validateCalendarMutation } from "../core/validation";

type RawCalendarEvent = Omit<CalendarEventRecord, "completed"> & { completed: number | boolean };

function parseBooleanFilter(value: string | null) {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

function parseQuery(request: Request): CalendarQuery {
  const url = new URL(request.url);
  const now = Date.now();
  return {
    from: cleanNumber(url.searchParams.get("from") ?? now - 31 * 86_400_000, 0, MAX_TIMESTAMP) ?? 0,
    to: cleanNumber(url.searchParams.get("to") ?? now + 93 * 86_400_000, 0, MAX_TIMESTAMP) ?? MAX_TIMESTAMP,
    projectId: cleanId(url.searchParams.get("projectId")),
    completed: parseBooleanFilter(url.searchParams.get("completed")),
    limit: Math.round(cleanNumber(url.searchParams.get("limit") ?? 200, 1, 500) ?? 200),
    cursor: cleanNumber(url.searchParams.get("cursor") ?? "", 0, MAX_TIMESTAMP),
  };
}

function normalize(row: RawCalendarEvent): CalendarEventRecord {
  return { ...row, completed: Boolean(row.completed) };
}

async function projectExists(context: NonNullable<Awaited<ReturnType<typeof apiContext>>>, projectId: string | null) {
  if (!projectId) return true;
  const row = await context.db.prepare("SELECT 1 FROM projects WHERE id=? AND user_id=?").bind(projectId, context.user.userId).first();
  return Boolean(row);
}

export async function GET(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const query = parseQuery(request);
  if (query.from > query.to) return apiError("INVALID_RANGE", "Дата початку має бути раніше дати завершення", 422);
  let sql = `SELECT
    id,
    project_id AS projectId,
    title,
    starts_at AS startsAt,
    duration_minutes AS durationMinutes,
    recurrence,
    completed,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM calendar_events
  WHERE user_id=? AND starts_at>=? AND starts_at<=?`;
  const values: unknown[] = [context.user.userId, query.from, query.to];
  if (query.projectId) { sql += " AND project_id=?"; values.push(query.projectId); }
  if (query.completed !== null) { sql += " AND completed=?"; values.push(query.completed ? 1 : 0); }
  if (query.cursor !== null) { sql += " AND starts_at>?"; values.push(query.cursor); }
  sql += " ORDER BY starts_at,id LIMIT ?";
  values.push(query.limit + 1);
  const result = await context.db.prepare(sql).bind(...values).all<RawCalendarEvent>();
  const hasMore = result.results.length > query.limit;
  const items = result.results.slice(0, query.limit).map(normalize);
  return apiOk({ items, hasMore, nextCursor: hasMore ? items.at(-1)?.startsAt ?? null : null, range: { from: query.from, to: query.to } });
}

export async function POST(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const body = await jsonBody(request);
  if (!body) return apiError("INVALID_JSON", "Некоректний JSON", 400);
  const validation = validateCalendarMutation(body);
  if (!validation.ok) return apiError("VALIDATION_ERROR", "Некоректні дані події", 422, { issues: validation.issues });
  const event = validation.value;
  if (!await projectExists(context, event.projectId)) return apiError("PROJECT_NOT_FOUND", "Проєкт не знайдено", 404);
  const existing = await context.db.prepare("SELECT 1 FROM calendar_events WHERE id=?").bind(event.id).first();
  if (existing) return apiError("EVENT_EXISTS", "Подія з таким ID вже існує", 409);
  const timestamp = Date.now();
  await context.db.prepare(
    `INSERT INTO calendar_events
      (id,user_id,project_id,title,starts_at,duration_minutes,recurrence,completed,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).bind(event.id, context.user.userId, event.projectId, event.title, event.startsAt, event.durationMinutes, event.recurrence, event.completed ? 1 : 0, timestamp, timestamp).run();
  const sync = await bumpRevision(context.db, context.user.userId);
  await recordActivity(context.db, context.user.userId, { action: "created", entityType: "event", entityId: event.id, label: `Заплановано «${event.title}»`, metadata: { startsAt: event.startsAt, durationMinutes: event.durationMinutes } });
  return apiOk({ ...event, createdAt: timestamp, updatedAt: timestamp, sync }, 201);
}

export async function PATCH(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const body = await jsonBody(request);
  if (!body) return apiError("INVALID_JSON", "Некоректний JSON", 400);
  const id = cleanId(body.id);
  if (!id) return apiError("VALIDATION_ERROR", "Некоректний ID події", 422);
  const current = await context.db.prepare(
    `SELECT
      id,
      project_id AS projectId,
      title,
      starts_at AS startsAt,
      duration_minutes AS durationMinutes,
      recurrence,
      completed
    FROM calendar_events
    WHERE id=? AND user_id=?`,
  ).bind(id, context.user.userId).first<CalendarMutation & { completed: number | boolean }>();
  if (!current) return apiError("NOT_FOUND", "Подію не знайдено", 404);
  const validation = validateCalendarMutation(body, { ...current, completed: Boolean(current.completed) });
  if (!validation.ok) return apiError("VALIDATION_ERROR", "Некоректні дані події", 422, { issues: validation.issues });
  const event = validation.value;
  if (!await projectExists(context, event.projectId)) return apiError("PROJECT_NOT_FOUND", "Проєкт не знайдено", 404);
  const updatedAt = Date.now();
  await context.db.prepare(
    `UPDATE calendar_events SET
      project_id=?,
      title=?,
      starts_at=?,
      duration_minutes=?,
      recurrence=?,
      completed=?,
      updated_at=?
    WHERE id=? AND user_id=?`,
  ).bind(event.projectId, event.title, event.startsAt, event.durationMinutes, event.recurrence, event.completed ? 1 : 0, updatedAt, event.id, context.user.userId).run();
  const sync = await bumpRevision(context.db, context.user.userId);
  await recordActivity(context.db, context.user.userId, { action: event.completed ? "completed" : "updated", entityType: "event", entityId: event.id, label: event.completed ? `Завершено «${event.title}»` : `Оновлено «${event.title}»` });
  return apiOk({ ...event, updatedAt, sync });
}

export async function DELETE(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const id = cleanId(new URL(request.url).searchParams.get("id"));
  if (!id) return apiError("VALIDATION_ERROR", "Некоректний ID події", 422);
  const current = await context.db.prepare("SELECT title FROM calendar_events WHERE id=? AND user_id=?").bind(id, context.user.userId).first<{ title: string }>();
  if (!current) return apiError("NOT_FOUND", "Подію не знайдено", 404);
  const result = await context.db.prepare("DELETE FROM calendar_events WHERE id=? AND user_id=?").bind(id, context.user.userId).run();
  if (!result.meta.changes) return apiError("NOT_FOUND", "Подію не знайдено", 404);
  const sync = await bumpRevision(context.db, context.user.userId);
  await recordActivity(context.db, context.user.userId, { action: "deleted", entityType: "event", entityId: id, label: `Видалено подію «${current.title}»` });
  return apiOk({ id, deleted: true, sync });
}
