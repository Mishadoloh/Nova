import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type Row = Record<string, unknown>;
type SyncPayload = {
  projects?: Row[];
  tasks?: Row[];
  sessions?: Row[];
  events?: Row[];
  preferences?: Row;
  baseRevision?: number;
  force?: boolean;
};

const MAX_ITEMS = 900;
const MAX_TIMESTAMP = 8_640_000_000_000_000;
const idPattern = /^[a-zA-Z0-9_-]{3,120}$/;
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const statuses = new Set(["todo", "doing", "done"]);

function error(code: string, message: string, status: number, details?: Record<string, unknown>) {
  return Response.json({ ok: false, error: { code, message, ...details } }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function finite(value: unknown, min = 0, max = MAX_TIMESTAMP) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function text(value: unknown, max: number) {
  const result = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return result && result.length <= max ? result : null;
}

function id(value: unknown) {
  return typeof value === "string" && idPattern.test(value) ? value : null;
}

function uniqueIds(items: Row[]) {
  const ids = items.map((item) => id(item.id));
  return ids.every(Boolean) && new Set(ids).size === ids.length;
}

function validatePayload(value: unknown): { payload: SyncPayload; problem?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { payload: {}, problem: "Тіло запиту має бути JSON-обʼєктом" };
  const payload = value as SyncPayload;
  for (const key of ["projects", "tasks", "sessions", "events"] as const) {
    if (payload[key] !== undefined && !Array.isArray(payload[key])) return { payload, problem: `${key} має бути масивом` };
  }
  const projects = payload.projects ?? [];
  const tasks = payload.tasks ?? [];
  const sessions = payload.sessions ?? [];
  const events = payload.events ?? [];
  if (projects.length + tasks.length + sessions.length + events.length > MAX_ITEMS) return { payload, problem: `Одна синхронізація підтримує до ${MAX_ITEMS} записів` };
  if (![projects, tasks, sessions, events].every(uniqueIds)) return { payload, problem: "ID мають бути коректними та унікальними" };

  const projectIds = new Set(projects.map((item) => String(item.id)));
  if (projects.some((item) => !text(item.name, 80) || !colorPattern.test(String(item.color ?? "")) || finite(item.createdAt) === null || (item.updatedAt !== undefined && finite(item.updatedAt) === null) || (item.deadline != null && finite(item.deadline) === null))) return { payload, problem: "Некоректні дані проєкту" };
  if (tasks.some((item) => !projectIds.has(String(item.projectId)) || !text(item.text, 240) || !statuses.has(String(item.status ?? (item.done ? "done" : "todo"))) || finite(item.createdAt) === null || (item.updatedAt !== undefined && finite(item.updatedAt) === null || finite(item.sortOrder ?? 0, 0, 100_000) === null) || (item.deadline != null && finite(item.deadline) === null))) return { payload, problem: "Некоректна задача або відсутній її проєкт" };
  if (sessions.some((item) => !projectIds.has(String(item.projectId)) || finite(item.startedAt) === null || finite(item.durationSeconds, 1, 43_200) === null)) return { payload, problem: "Некоректна фокус-сесія або відсутній її проєкт" };
  if (events.some((item) => (item.projectId != null && !projectIds.has(String(item.projectId))) || !text(item.title, 160) || finite(item.startsAt) === null || finite(item.durationMinutes, 1, 1_440) === null || finite(item.createdAt) === null || (item.updatedAt !== undefined && finite(item.updatedAt) === null))) return { payload, problem: "Некоректна календарна подія" };
  if (payload.baseRevision !== undefined && finite(payload.baseRevision, 0, Number.MAX_SAFE_INTEGER) === null) return { payload, problem: "Некоректна ревізія синхронізації" };
  return { payload };
}

async function readUserData(userId: string) {
  const db = env.DB;
  const [projectRows, taskRows, sessionRows, eventRows, preferenceRows, metaRows] = await db.batch([
    db.prepare("SELECT id,name,color,deadline,archived,created_at AS createdAt,updated_at AS updatedAt FROM projects WHERE user_id=? ORDER BY archived,created_at").bind(userId),
    db.prepare("SELECT id,project_id AS projectId,text,done,status,deadline,recurrence,sort_order AS sortOrder,created_at AS createdAt,updated_at AS updatedAt FROM tasks WHERE user_id=? ORDER BY sort_order,created_at").bind(userId),
    db.prepare("SELECT id,project_id AS projectId,started_at AS startedAt,duration_seconds AS durationSeconds FROM focus_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 700").bind(userId),
    db.prepare("SELECT id,project_id AS projectId,title,starts_at AS startsAt,duration_minutes AS durationMinutes,recurrence,completed,created_at AS createdAt,updated_at AS updatedAt FROM calendar_events WHERE user_id=? ORDER BY starts_at LIMIT 700").bind(userId),
    db.prepare("SELECT focus_minutes AS focusMinutes,break_minutes AS breakMinutes,auto_pomodoro AS autoPomodoro,daily_goal_minutes AS dailyGoalMinutes,active_project_id AS activeProjectId,timer_mode AS timerMode FROM user_preferences WHERE user_id=?").bind(userId),
    db.prepare("SELECT revision,updated_at AS updatedAt FROM sync_meta WHERE user_id=?").bind(userId),
  ]);
  return {
    projects: projectRows.results.map((item) => ({ ...item, archived: Boolean(item.archived) })),
    tasks: taskRows.results.map((item) => ({ ...item, done: Boolean(item.done) })),
    sessions: sessionRows.results,
    events: eventRows.results.map((item) => ({ ...item, completed: Boolean(item.completed) })),
    preferences: preferenceRows.results[0] ? { ...preferenceRows.results[0], autoPomodoro: Boolean(preferenceRows.results[0].autoPomodoro) } : null,
    revision: Number(metaRows.results[0]?.revision ?? 0),
    updatedAt: Number(metaRows.results[0]?.updatedAt ?? 0),
  };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return error("AUTH_REQUIRED", "Потрібна авторизація", 401);
  const data = await readUserData(user.userId);
  return Response.json({ user: { displayName: user.displayName, email: user.email }, ...data }, { headers: { "Cache-Control": "no-store", "X-Nova-Revision": String(data.revision), "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return error("AUTH_REQUIRED", "Потрібна авторизація", 401);
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > 2_000_000) return error("PAYLOAD_TOO_LARGE", "Забагато даних для однієї синхронізації", 413);

  let raw: unknown;
  try { raw = await request.json(); } catch { return error("INVALID_JSON", "Некоректний JSON", 400); }
  const validation = validatePayload(raw);
  if (validation.problem) return error("VALIDATION_ERROR", validation.problem, 422);

  const payload = validation.payload;
  const db = env.DB;
  const current = await db.prepare("SELECT revision FROM sync_meta WHERE user_id=?").bind(user.userId).first<{ revision: number }>();
  const currentRevision = Number(current?.revision ?? 0);
  if (!payload.force && payload.baseRevision !== undefined && payload.baseRevision < currentRevision) return error("SYNC_CONFLICT", "Дані змінилися на іншому пристрої", 409, { revision: currentRevision });

  const projects = payload.projects ?? [];
  const tasks = payload.tasks ?? [];
  const sessions = payload.sessions ?? [];
  const events = payload.events ?? [];
  const preferences = payload.preferences ?? { focusMinutes: 25, breakMinutes: 5, autoPomodoro: false, dailyGoalMinutes: 120, activeProjectId: null, timerMode: "focus" };
  const timestamp = Date.now();
  const nextRevision = currentRevision + 1;
  const statements = [
    db.prepare("DELETE FROM tasks WHERE user_id=?").bind(user.userId),
    db.prepare("DELETE FROM projects WHERE user_id=?").bind(user.userId),
    db.prepare("DELETE FROM focus_sessions WHERE user_id=?").bind(user.userId),
  ];
  if (payload.events !== undefined) statements.push(db.prepare("DELETE FROM calendar_events WHERE user_id=?").bind(user.userId));
  projects.forEach((item) => statements.push(db.prepare("INSERT INTO projects (id,user_id,name,color,deadline,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(item.id, user.userId, text(item.name, 80), item.color, item.deadline ?? null, item.archived ? 1 : 0, finite(item.createdAt), finite(item.updatedAt ?? timestamp))));
  tasks.forEach((item) => statements.push(db.prepare("INSERT INTO tasks (id,user_id,project_id,text,done,status,deadline,recurrence,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(item.id, user.userId, item.projectId, text(item.text, 240), item.done ? 1 : 0, String(item.status ?? (item.done ? "done" : "todo")), item.deadline ?? null, item.recurrence == null ? null : String(item.recurrence).slice(0, 32), finite(item.sortOrder ?? 0, 0, 100_000), finite(item.createdAt), finite(item.updatedAt ?? timestamp))));
  sessions.forEach((item) => statements.push(db.prepare("INSERT INTO focus_sessions (id,user_id,project_id,started_at,duration_seconds) VALUES (?,?,?,?,?)").bind(item.id, user.userId, item.projectId, finite(item.startedAt), finite(item.durationSeconds, 1, 43_200))));
  if (payload.events !== undefined) events.forEach((item) => statements.push(db.prepare("INSERT INTO calendar_events (id,user_id,project_id,title,starts_at,duration_minutes,recurrence,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(item.id, user.userId, item.projectId ?? null, text(item.title, 160), finite(item.startsAt), finite(item.durationMinutes, 1, 1_440), item.recurrence == null ? null : String(item.recurrence).slice(0, 32), item.completed ? 1 : 0, finite(item.createdAt), finite(item.updatedAt ?? timestamp))));
  statements.push(db.prepare("INSERT INTO user_preferences (user_id,focus_minutes,break_minutes,auto_pomodoro,daily_goal_minutes,active_project_id,timer_mode,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET focus_minutes=excluded.focus_minutes,break_minutes=excluded.break_minutes,auto_pomodoro=excluded.auto_pomodoro,daily_goal_minutes=excluded.daily_goal_minutes,active_project_id=excluded.active_project_id,timer_mode=excluded.timer_mode,updated_at=excluded.updated_at").bind(user.userId, finite(preferences.focusMinutes, 1, 120) ?? 25, finite(preferences.breakMinutes, 1, 60) ?? 5, preferences.autoPomodoro ? 1 : 0, finite(preferences.dailyGoalMinutes ?? 120, 15, 720) ?? 120, id(preferences.activeProjectId) && projects.some((item) => item.id === preferences.activeProjectId) ? preferences.activeProjectId : null, preferences.timerMode === "break" ? "break" : "focus", timestamp));
  statements.push(db.prepare("INSERT INTO sync_meta (user_id,revision,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,updated_at=excluded.updated_at").bind(user.userId, nextRevision, timestamp));
  await db.batch(statements);
  return Response.json({ ok: true, syncedAt: timestamp, revision: nextRevision, counts: { projects: projects.length, tasks: tasks.length, sessions: sessions.length, events: events.length } }, { headers: { "Cache-Control": "no-store", "X-Nova-Revision": String(nextRevision), "X-Content-Type-Options": "nosniff" } });
}
