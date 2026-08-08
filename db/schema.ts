import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_projects_user_created").on(table.userId, table.createdAt)]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(),
  text: text("text").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_tasks_user_project").on(table.userId, table.projectId)]);

export const focusSessions = sqliteTable("focus_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(),
  startedAt: integer("started_at").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
}, (table) => [index("idx_sessions_user_started").on(table.userId, table.startedAt)]);

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  focusMinutes: integer("focus_minutes").notNull().default(25),
  breakMinutes: integer("break_minutes").notNull().default(5),
  autoPomodoro: integer("auto_pomodoro", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at").notNull(),
});
