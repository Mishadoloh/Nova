import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  deadline: integer("deadline"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull().default(0),
}, (table) => [index("idx_projects_user_created").on(table.userId, table.createdAt)]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(),
  text: text("text").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("todo"),
  deadline: integer("deadline"),
  recurrence: text("recurrence"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull().default(0),
}, (table) => [
  index("idx_tasks_user_project").on(table.userId, table.projectId),
  index("idx_tasks_user_status_sort").on(table.userId, table.status, table.sortOrder),
]);

export const focusSessions = sqliteTable("focus_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(),
  startedAt: integer("started_at").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
}, (table) => [
  index("idx_sessions_user_started").on(table.userId, table.startedAt),
  index("idx_sessions_user_project_started").on(table.userId, table.projectId, table.startedAt),
]);

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  focusMinutes: integer("focus_minutes").notNull().default(25),
  breakMinutes: integer("break_minutes").notNull().default(5),
  autoPomodoro: integer("auto_pomodoro", { mode: "boolean" }).notNull().default(false),
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(120),
  activeProjectId: text("active_project_id"),
  timerMode: text("timer_mode").notNull().default("focus"),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const calendarEvents = sqliteTable("calendar_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id"),
  title: text("title").notNull(),
  startsAt: integer("starts_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  recurrence: text("recurrence"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_events_user_starts").on(table.userId, table.startsAt),
  index("idx_events_user_project_starts").on(table.userId, table.projectId, table.startsAt),
]);

export const syncMeta = sqliteTable("sync_meta", {
  userId: text("user_id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  focusArea: text("focus_area").notNull().default("work"),
  timezone: text("timezone").notNull().default("Europe/Kyiv"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
