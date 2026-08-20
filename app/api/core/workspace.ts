import type { env } from "cloudflare:workers";
import type {
  BackupPreview,
  CalendarEventRecord,
  FocusSessionRecord,
  PreferenceRecord,
  ProjectRecord,
  RestoreMode,
  TaskRecord,
  WorkspaceSnapshot,
} from "./contracts";

type D1Database = typeof env.DB;

type RawProject = Omit<ProjectRecord, "archived"> & { archived: number | boolean };
type RawTask = Omit<TaskRecord, "done"> & { done: number | boolean };
type RawEvent = Omit<CalendarEventRecord, "completed"> & { completed: number | boolean };
type RawPreferences = Omit<PreferenceRecord, "autoPomodoro"> & { autoPomodoro: number | boolean };

export async function readWorkspace(db: D1Database, userId: string): Promise<WorkspaceSnapshot> {
  const [projectsResult, tasksResult, sessionsResult, eventsResult, preferencesResult] = await db.batch([
    db.prepare(
      `SELECT
        id,
        name,
        color,
        deadline,
        archived,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM projects
      WHERE user_id = ?
      ORDER BY archived, created_at`,
    ).bind(userId),
    db.prepare(
      `SELECT
        id,
        project_id AS projectId,
        text,
        done,
        status,
        deadline,
        recurrence,
        sort_order AS sortOrder,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM tasks
      WHERE user_id = ?
      ORDER BY sort_order, created_at`,
    ).bind(userId),
    db.prepare(
      `SELECT
        id,
        project_id AS projectId,
        started_at AS startedAt,
        duration_seconds AS durationSeconds
      FROM focus_sessions
      WHERE user_id = ?
      ORDER BY started_at DESC
      LIMIT 700`,
    ).bind(userId),
    db.prepare(
      `SELECT
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
      WHERE user_id = ?
      ORDER BY starts_at
      LIMIT 700`,
    ).bind(userId),
    db.prepare(
      `SELECT
        focus_minutes AS focusMinutes,
        break_minutes AS breakMinutes,
        auto_pomodoro AS autoPomodoro,
        daily_goal_minutes AS dailyGoalMinutes,
        active_project_id AS activeProjectId,
        timer_mode AS timerMode
      FROM user_preferences
      WHERE user_id = ?`,
    ).bind(userId),
  ]);

  const projects = (projectsResult.results as unknown as RawProject[]).map((project) => ({
    ...project,
    archived: Boolean(project.archived),
  }));
  const tasks = (tasksResult.results as unknown as RawTask[]).map((task) => ({
    ...task,
    done: Boolean(task.done),
  }));
  const sessions = sessionsResult.results as unknown as FocusSessionRecord[];
  const events = (eventsResult.results as unknown as RawEvent[]).map((event) => ({
    ...event,
    completed: Boolean(event.completed),
  }));
  const rawPreferences = preferencesResult.results[0] as unknown as RawPreferences | undefined;
  const preferences: PreferenceRecord = rawPreferences
    ? { ...rawPreferences, autoPomodoro: Boolean(rawPreferences.autoPomodoro), timerMode: rawPreferences.timerMode === "break" ? "break" : "focus" }
    : { focusMinutes: 25, breakMinutes: 5, autoPomodoro: false, dailyGoalMinutes: 120, activeProjectId: projects[0]?.id ?? null, timerMode: "focus" };
  return { projects, tasks, sessions, events, preferences };
}

function timestampOf(item: { updatedAt?: number; createdAt?: number; startedAt?: number }) {
  return item.updatedAt ?? item.createdAt ?? item.startedAt ?? 0;
}

export function mergeRecords<T extends { id: string; updatedAt?: number; createdAt?: number; startedAt?: number }>(current: T[], imported: T[]) {
  const records = new Map(current.map((item) => [item.id, item]));
  for (const item of imported) {
    const previous = records.get(item.id);
    if (!previous || timestampOf(item) >= timestampOf(previous)) records.set(item.id, item);
  }
  return [...records.values()];
}

export function mergeWorkspace(current: WorkspaceSnapshot, imported: WorkspaceSnapshot): WorkspaceSnapshot {
  const projects = mergeRecords(current.projects, imported.projects);
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = mergeRecords(current.tasks, imported.tasks).filter((task) => projectIds.has(task.projectId));
  const sessions = mergeRecords(current.sessions, imported.sessions).filter((session) => projectIds.has(session.projectId));
  const events = mergeRecords(current.events, imported.events).filter((event) => !event.projectId || projectIds.has(event.projectId));
  const importedActiveProject = imported.preferences.activeProjectId;
  const activeProjectId = importedActiveProject && projectIds.has(importedActiveProject)
    ? importedActiveProject
    : current.preferences.activeProjectId && projectIds.has(current.preferences.activeProjectId)
      ? current.preferences.activeProjectId
      : projects[0]?.id ?? null;
  return {
    projects,
    tasks,
    sessions,
    events,
    preferences: { ...current.preferences, ...imported.preferences, activeProjectId },
  };
}

export function createBackupPreview(data: WorkspaceSnapshot): BackupPreview {
  const timestamps = [
    ...data.projects.flatMap((item) => [item.createdAt, item.updatedAt]),
    ...data.tasks.flatMap((item) => [item.createdAt, item.updatedAt]),
    ...data.sessions.map((item) => item.startedAt),
    ...data.events.flatMap((item) => [item.createdAt, item.updatedAt, item.startsAt]),
  ].filter((value) => Number.isFinite(value));
  const projects = data.projects.length;
  const tasks = data.tasks.length;
  const sessions = data.sessions.length;
  const events = data.events.length;
  return {
    valid: true,
    counts: { projects, tasks, sessions, events, total: projects + tasks + sessions + events },
    dateRange: {
      first: timestamps.length ? Math.min(...timestamps) : null,
      last: timestamps.length ? Math.max(...timestamps) : null,
    },
    issues: [],
  };
}

function projectStatement(db: D1Database, userId: string, project: ProjectRecord) {
  return db.prepare(
    `INSERT INTO projects
      (id,user_id,name,color,deadline,archived,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      color=excluded.color,
      deadline=excluded.deadline,
      archived=excluded.archived,
      updated_at=excluded.updated_at
    WHERE projects.user_id=excluded.user_id`,
  ).bind(project.id, userId, project.name, project.color, project.deadline, project.archived ? 1 : 0, project.createdAt, project.updatedAt);
}

function taskStatement(db: D1Database, userId: string, task: TaskRecord) {
  return db.prepare(
    `INSERT INTO tasks
      (id,user_id,project_id,text,done,status,deadline,recurrence,sort_order,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      project_id=excluded.project_id,
      text=excluded.text,
      done=excluded.done,
      status=excluded.status,
      deadline=excluded.deadline,
      recurrence=excluded.recurrence,
      sort_order=excluded.sort_order,
      updated_at=excluded.updated_at
    WHERE tasks.user_id=excluded.user_id`,
  ).bind(task.id, userId, task.projectId, task.text, task.done ? 1 : 0, task.status, task.deadline, task.recurrence, task.sortOrder, task.createdAt, task.updatedAt);
}

function sessionStatement(db: D1Database, userId: string, session: FocusSessionRecord) {
  return db.prepare(
    `INSERT INTO focus_sessions
      (id,user_id,project_id,started_at,duration_seconds)
    VALUES (?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      project_id=excluded.project_id,
      started_at=excluded.started_at,
      duration_seconds=excluded.duration_seconds
    WHERE focus_sessions.user_id=excluded.user_id`,
  ).bind(session.id, userId, session.projectId, session.startedAt, session.durationSeconds);
}

function eventStatement(db: D1Database, userId: string, event: CalendarEventRecord) {
  return db.prepare(
    `INSERT INTO calendar_events
      (id,user_id,project_id,title,starts_at,duration_minutes,recurrence,completed,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      project_id=excluded.project_id,
      title=excluded.title,
      starts_at=excluded.starts_at,
      duration_minutes=excluded.duration_minutes,
      recurrence=excluded.recurrence,
      completed=excluded.completed,
      updated_at=excluded.updated_at
    WHERE calendar_events.user_id=excluded.user_id`,
  ).bind(event.id, userId, event.projectId, event.title, event.startsAt, event.durationMinutes, event.recurrence, event.completed ? 1 : 0, event.createdAt, event.updatedAt);
}

function preferenceStatement(db: D1Database, userId: string, preferences: PreferenceRecord, timestamp: number) {
  return db.prepare(
    `INSERT INTO user_preferences
      (user_id,focus_minutes,break_minutes,auto_pomodoro,daily_goal_minutes,active_project_id,timer_mode,updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      focus_minutes=excluded.focus_minutes,
      break_minutes=excluded.break_minutes,
      auto_pomodoro=excluded.auto_pomodoro,
      daily_goal_minutes=excluded.daily_goal_minutes,
      active_project_id=excluded.active_project_id,
      timer_mode=excluded.timer_mode,
      updated_at=excluded.updated_at`,
  ).bind(userId, preferences.focusMinutes, preferences.breakMinutes, preferences.autoPomodoro ? 1 : 0, preferences.dailyGoalMinutes, preferences.activeProjectId, preferences.timerMode, timestamp);
}

export async function writeWorkspace(db: D1Database, userId: string, data: WorkspaceSnapshot, mode: Exclude<RestoreMode, "preview">) {
  const timestamp = Date.now();
  const statements = [];
  if (mode === "replace") {
    statements.push(
      db.prepare("DELETE FROM tasks WHERE user_id=?").bind(userId),
      db.prepare("DELETE FROM focus_sessions WHERE user_id=?").bind(userId),
      db.prepare("DELETE FROM calendar_events WHERE user_id=?").bind(userId),
      db.prepare("DELETE FROM projects WHERE user_id=?").bind(userId),
    );
  }
  for (const project of data.projects) statements.push(projectStatement(db, userId, project));
  for (const task of data.tasks) statements.push(taskStatement(db, userId, task));
  for (const session of data.sessions) statements.push(sessionStatement(db, userId, session));
  for (const event of data.events) statements.push(eventStatement(db, userId, event));
  statements.push(preferenceStatement(db, userId, data.preferences, timestamp));
  await db.batch(statements);
  return timestamp;
}
