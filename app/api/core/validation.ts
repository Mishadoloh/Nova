import type {
  BackupEnvelope,
  CalendarMutation,
  FocusSessionRecord,
  PreferenceRecord,
  ProjectRecord,
  TaskRecord,
  ValidationIssue,
  ValidationResult,
  WorkspaceSnapshot,
  CalendarEventRecord,
  TaskStatus,
} from "./contracts";

export const MAX_TIMESTAMP = 8_640_000_000_000_000;
export const MAX_BACKUP_ITEMS = 900;
export const MAX_BACKUP_BYTES = 2_000_000;
export const ID_PATTERN = /^[a-zA-Z0-9_-]{3,120}$/;
export const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const RECURRENCES = new Set(["none", "daily", "weekly", "weekdays", "monthly"]);
export const TASK_STATUSES = new Set<TaskStatus>(["todo", "doing", "done"]);

function issue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asString(value: unknown, maxLength: number, required = true) {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.trim().replace(/\s+/g, " ");
  if (required && !normalized) return null;
  return normalized.length <= maxLength ? normalized : null;
}

export function asIdentifier(value: unknown) {
  return typeof value === "string" && ID_PATTERN.test(value) ? value : null;
}

export function asColor(value: unknown, fallback: string | null = null) {
  return typeof value === "string" && COLOR_PATTERN.test(value) ? value.toLowerCase() : fallback;
}

export function asFiniteNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function asInteger(value: unknown, min: number, max: number) {
  const number = asFiniteNumber(value, min, max);
  return number === null ? null : Math.round(number);
}

export function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

export function asNullableTimestamp(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return asInteger(value, 0, MAX_TIMESTAMP);
}

export function asRecurrence(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "none") return null;
  const recurrence = asString(value, 32);
  return recurrence && RECURRENCES.has(recurrence) ? recurrence : null;
}

export function uniqueIdentifiers(items: Array<{ id: string }>) {
  return new Set(items.map((item) => item.id)).size === items.length;
}

export function validateProject(value: unknown, path: string): ValidationResult<ProjectRecord> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) return { ok: false, value: null, issues: [issue(path, "TYPE", "Проєкт має бути обʼєктом")] };
  const id = asIdentifier(value.id);
  const name = asString(value.name, 80);
  const color = asColor(value.color);
  const deadline = asNullableTimestamp(value.deadline);
  const createdAt = asInteger(value.createdAt, 0, MAX_TIMESTAMP);
  const updatedAt = asInteger(value.updatedAt ?? value.createdAt, 0, MAX_TIMESTAMP);
  if (!id) issues.push(issue(`${path}.id`, "ID", "Некоректний ID проєкту"));
  if (!name) issues.push(issue(`${path}.name`, "NAME", "Назва проєкту має містити до 80 символів"));
  if (!color) issues.push(issue(`${path}.color`, "COLOR", "Колір має бути у форматі #RRGGBB"));
  if (value.deadline != null && deadline === null) issues.push(issue(`${path}.deadline`, "DATE", "Некоректний дедлайн"));
  if (createdAt === null || updatedAt === null) issues.push(issue(`${path}.createdAt`, "DATE", "Некоректна дата проєкту"));
  if (issues.length || !id || !name || !color || createdAt === null || updatedAt === null) return { ok: false, value: null, issues };
  return { ok: true, value: { id, name, color, deadline, archived: asBoolean(value.archived), createdAt, updatedAt }, issues: [] };
}

export function validateTask(value: unknown, path: string, projectIds: Set<string>): ValidationResult<TaskRecord> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) return { ok: false, value: null, issues: [issue(path, "TYPE", "Задача має бути обʼєктом")] };
  const id = asIdentifier(value.id);
  const projectId = asIdentifier(value.projectId);
  const text = asString(value.text, 240);
  const rawStatus = value.status ?? (asBoolean(value.done) ? "done" : "todo");
  const status = typeof rawStatus === "string" && TASK_STATUSES.has(rawStatus as TaskStatus) ? rawStatus as TaskStatus : null;
  const deadline = asNullableTimestamp(value.deadline);
  const recurrence = asRecurrence(value.recurrence);
  const sortOrder = asInteger(value.sortOrder ?? 0, 0, 100_000);
  const createdAt = asInteger(value.createdAt, 0, MAX_TIMESTAMP);
  const updatedAt = asInteger(value.updatedAt ?? value.createdAt, 0, MAX_TIMESTAMP);
  if (!id) issues.push(issue(`${path}.id`, "ID", "Некоректний ID задачі"));
  if (!projectId || !projectIds.has(projectId)) issues.push(issue(`${path}.projectId`, "PROJECT", "Проєкт задачі не знайдено"));
  if (!text) issues.push(issue(`${path}.text`, "TEXT", "Текст задачі має містити до 240 символів"));
  if (!status) issues.push(issue(`${path}.status`, "STATUS", "Некоректний статус задачі"));
  if (value.deadline != null && deadline === null) issues.push(issue(`${path}.deadline`, "DATE", "Некоректний дедлайн задачі"));
  if (value.recurrence != null && value.recurrence !== "none" && recurrence === null) issues.push(issue(`${path}.recurrence`, "RECURRENCE", "Некоректне повторення задачі"));
  if (sortOrder === null) issues.push(issue(`${path}.sortOrder`, "ORDER", "Некоректний порядок задачі"));
  if (createdAt === null || updatedAt === null) issues.push(issue(`${path}.createdAt`, "DATE", "Некоректна дата задачі"));
  if (issues.length || !id || !projectId || !text || !status || sortOrder === null || createdAt === null || updatedAt === null) return { ok: false, value: null, issues };
  return { ok: true, value: { id, projectId, text, done: status === "done", status, deadline, recurrence, sortOrder, createdAt, updatedAt }, issues: [] };
}

export function validateSession(value: unknown, path: string, projectIds: Set<string>): ValidationResult<FocusSessionRecord> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) return { ok: false, value: null, issues: [issue(path, "TYPE", "Сесія має бути обʼєктом")] };
  const id = asIdentifier(value.id);
  const projectId = asIdentifier(value.projectId);
  const startedAt = asInteger(value.startedAt, 0, MAX_TIMESTAMP);
  const durationSeconds = asInteger(value.durationSeconds, 1, 43_200);
  if (!id) issues.push(issue(`${path}.id`, "ID", "Некоректний ID сесії"));
  if (!projectId || !projectIds.has(projectId)) issues.push(issue(`${path}.projectId`, "PROJECT", "Проєкт сесії не знайдено"));
  if (startedAt === null) issues.push(issue(`${path}.startedAt`, "DATE", "Некоректний початок сесії"));
  if (durationSeconds === null) issues.push(issue(`${path}.durationSeconds`, "DURATION", "Тривалість має бути від 1 секунди до 12 годин"));
  if (issues.length || !id || !projectId || startedAt === null || durationSeconds === null) return { ok: false, value: null, issues };
  return { ok: true, value: { id, projectId, startedAt, durationSeconds }, issues: [] };
}

export function validateCalendarEvent(value: unknown, path: string, projectIds: Set<string>): ValidationResult<CalendarEventRecord> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) return { ok: false, value: null, issues: [issue(path, "TYPE", "Подія має бути обʼєктом")] };
  const id = asIdentifier(value.id);
  const projectId = value.projectId == null ? null : asIdentifier(value.projectId);
  const title = asString(value.title, 160);
  const startsAt = asInteger(value.startsAt, 0, MAX_TIMESTAMP);
  const durationMinutes = asInteger(value.durationMinutes, 1, 1_440);
  const recurrence = asRecurrence(value.recurrence);
  const createdAt = asInteger(value.createdAt, 0, MAX_TIMESTAMP);
  const updatedAt = asInteger(value.updatedAt ?? value.createdAt, 0, MAX_TIMESTAMP);
  if (!id) issues.push(issue(`${path}.id`, "ID", "Некоректний ID події"));
  if (value.projectId != null && (!projectId || !projectIds.has(projectId))) issues.push(issue(`${path}.projectId`, "PROJECT", "Проєкт події не знайдено"));
  if (!title) issues.push(issue(`${path}.title`, "TITLE", "Назва події має містити до 160 символів"));
  if (startsAt === null) issues.push(issue(`${path}.startsAt`, "DATE", "Некоректний час події"));
  if (durationMinutes === null) issues.push(issue(`${path}.durationMinutes`, "DURATION", "Тривалість має бути від 1 хвилини до 24 годин"));
  if (value.recurrence != null && value.recurrence !== "none" && recurrence === null) issues.push(issue(`${path}.recurrence`, "RECURRENCE", "Некоректне повторення події"));
  if (createdAt === null || updatedAt === null) issues.push(issue(`${path}.createdAt`, "DATE", "Некоректна дата події"));
  if (issues.length || !id || !title || startsAt === null || durationMinutes === null || createdAt === null || updatedAt === null) return { ok: false, value: null, issues };
  return { ok: true, value: { id, projectId, title, startsAt, durationMinutes, recurrence, completed: asBoolean(value.completed), createdAt, updatedAt }, issues: [] };
}

export function validatePreferences(value: unknown): ValidationResult<PreferenceRecord> {
  const source = isRecord(value) ? value : {};
  const focusMinutes = asInteger(source.focusMinutes ?? 25, 1, 120);
  const breakMinutes = asInteger(source.breakMinutes ?? 5, 1, 60);
  const dailyGoalMinutes = asInteger(source.dailyGoalMinutes ?? 120, 15, 720);
  const activeProjectId = source.activeProjectId == null ? null : asIdentifier(source.activeProjectId);
  const timerMode = source.timerMode === "break" ? "break" : "focus";
  const issues: ValidationIssue[] = [];
  if (focusMinutes === null) issues.push(issue("preferences.focusMinutes", "RANGE", "Фокус має тривати від 1 до 120 хвилин"));
  if (breakMinutes === null) issues.push(issue("preferences.breakMinutes", "RANGE", "Перерва має тривати від 1 до 60 хвилин"));
  if (dailyGoalMinutes === null) issues.push(issue("preferences.dailyGoalMinutes", "RANGE", "Денна ціль має бути від 15 до 720 хвилин"));
  if (issues.length || focusMinutes === null || breakMinutes === null || dailyGoalMinutes === null) return { ok: false, value: null, issues };
  return { ok: true, value: { focusMinutes, breakMinutes, autoPomodoro: asBoolean(source.autoPomodoro), dailyGoalMinutes, activeProjectId, timerMode }, issues: [] };
}

export function validateWorkspace(value: unknown): ValidationResult<WorkspaceSnapshot> {
  if (!isRecord(value)) return { ok: false, value: null, issues: [issue("data", "TYPE", "Резервна копія має містити обʼєкт data")] };
  const projectsRaw = Array.isArray(value.projects) ? value.projects : null;
  const tasksRaw = Array.isArray(value.tasks) ? value.tasks : null;
  const sessionsRaw = Array.isArray(value.sessions) ? value.sessions : null;
  const eventsRaw = Array.isArray(value.events) ? value.events : [];
  if (!projectsRaw || !tasksRaw || !sessionsRaw) return { ok: false, value: null, issues: [issue("data", "SHAPE", "Потрібні масиви projects, tasks і sessions")] };
  const total = projectsRaw.length + tasksRaw.length + sessionsRaw.length + eventsRaw.length;
  if (total > MAX_BACKUP_ITEMS) return { ok: false, value: null, issues: [issue("data", "LIMIT", `Резервна копія підтримує до ${MAX_BACKUP_ITEMS} записів`)] };
  const projectResults = projectsRaw.map((item, index) => validateProject(item, `projects[${index}]`));
  const projects = projectResults.flatMap((result) => result.ok ? [result.value] : []);
  const projectIds = new Set(projects.map((project) => project.id));
  const taskResults = tasksRaw.map((item, index) => validateTask(item, `tasks[${index}]`, projectIds));
  const sessionResults = sessionsRaw.map((item, index) => validateSession(item, `sessions[${index}]`, projectIds));
  const eventResults = eventsRaw.map((item, index) => validateCalendarEvent(item, `events[${index}]`, projectIds));
  const preferenceResult = validatePreferences(value.preferences);
  const issues = [...projectResults, ...taskResults, ...sessionResults, ...eventResults, preferenceResult].flatMap((result) => result.ok ? [] : result.issues).slice(0, 50);
  if (!uniqueIdentifiers(projects)) issues.push(issue("projects", "DUPLICATE", "Проєкти містять дублікати ID"));
  const tasks = taskResults.flatMap((result) => result.ok ? [result.value] : []);
  const sessions = sessionResults.flatMap((result) => result.ok ? [result.value] : []);
  const events = eventResults.flatMap((result) => result.ok ? [result.value] : []);
  if (!uniqueIdentifiers(tasks)) issues.push(issue("tasks", "DUPLICATE", "Задачі містять дублікати ID"));
  if (!uniqueIdentifiers(sessions)) issues.push(issue("sessions", "DUPLICATE", "Сесії містять дублікати ID"));
  if (!uniqueIdentifiers(events)) issues.push(issue("events", "DUPLICATE", "Події містять дублікати ID"));
  if (issues.length || !preferenceResult.ok) return { ok: false, value: null, issues };
  return { ok: true, value: { projects, tasks, sessions, events, preferences: preferenceResult.value }, issues: [] };
}

export function unwrapBackup(value: unknown): ValidationResult<WorkspaceSnapshot> {
  if (!isRecord(value)) return validateWorkspace(value);
  if (value.format === "nova-backup") return validateWorkspace(value.data);
  if (isRecord(value.data) && value.mode !== undefined) return validateWorkspace(value.data);
  return validateWorkspace(value);
}

export function createBackupEnvelope(data: WorkspaceSnapshot): BackupEnvelope {
  return { format: "nova-backup", version: 1, exportedAt: Date.now(), data };
}

export function validateCalendarMutation(value: unknown, existing?: Partial<CalendarMutation>): ValidationResult<CalendarMutation> {
  if (!isRecord(value)) return { ok: false, value: null, issues: [issue("body", "TYPE", "Тіло запиту має бути обʼєктом")] };
  const id = asIdentifier(value.id ?? existing?.id);
  const projectId = value.projectId === undefined ? existing?.projectId ?? null : value.projectId == null ? null : asIdentifier(value.projectId);
  const title = asString(value.title ?? existing?.title, 160);
  const startsAt = asInteger(value.startsAt ?? existing?.startsAt, 0, MAX_TIMESTAMP);
  const durationMinutes = asInteger(value.durationMinutes ?? existing?.durationMinutes, 1, 1_440);
  const recurrence = value.recurrence === undefined ? existing?.recurrence ?? null : asRecurrence(value.recurrence);
  const completed = value.completed === undefined ? existing?.completed ?? false : asBoolean(value.completed);
  const issues: ValidationIssue[] = [];
  if (!id) issues.push(issue("id", "ID", "Некоректний ID події"));
  if (value.projectId != null && !projectId) issues.push(issue("projectId", "ID", "Некоректний ID проєкту"));
  if (!title) issues.push(issue("title", "TITLE", "Назва події обовʼязкова"));
  if (startsAt === null) issues.push(issue("startsAt", "DATE", "Некоректний час початку"));
  if (durationMinutes === null) issues.push(issue("durationMinutes", "DURATION", "Некоректна тривалість"));
  if (issues.length || !id || !title || startsAt === null || durationMinutes === null) return { ok: false, value: null, issues };
  return { ok: true, value: { id, projectId, title, startsAt, durationMinutes, recurrence, completed }, issues: [] };
}
