import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type SyncPayload = {
  projects?: Array<{ id: string; name: string; color: string; createdAt: number }>;
  tasks?: Array<{ id: string; projectId: string; text: string; done: boolean; createdAt: number }>;
  sessions?: Array<{ id: string; projectId: string; startedAt: number; durationSeconds: number }>;
  preferences?: { focusMinutes: number; breakMinutes: number; autoPomodoro: boolean };
};

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  const db = env.DB;
  const [projectRows, taskRows, sessionRows, preferenceRows] = await db.batch([
    db.prepare("SELECT id, name, color, created_at AS createdAt FROM projects WHERE user_id = ? ORDER BY created_at").bind(user.userId),
    db.prepare("SELECT id, project_id AS projectId, text, done, created_at AS createdAt FROM tasks WHERE user_id = ? ORDER BY created_at").bind(user.userId),
    db.prepare("SELECT id, project_id AS projectId, started_at AS startedAt, duration_seconds AS durationSeconds FROM focus_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 365").bind(user.userId),
    db.prepare("SELECT focus_minutes AS focusMinutes, break_minutes AS breakMinutes, auto_pomodoro AS autoPomodoro FROM user_preferences WHERE user_id = ?").bind(user.userId),
  ]);

  return Response.json({
    user: { displayName: user.displayName, email: user.email },
    projects: projectRows.results,
    tasks: taskRows.results.map((task) => ({ ...task, done: Boolean(task.done) })),
    sessions: sessionRows.results,
    preferences: preferenceRows.results[0] ? { ...preferenceRows.results[0], autoPomodoro: Boolean(preferenceRows.results[0].autoPomodoro) } : null,
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  const payload = (await request.json()) as SyncPayload;
  const projects = (payload.projects ?? []).slice(0, 50);
  const tasks = (payload.tasks ?? []).slice(0, 500);
  const sessions = (payload.sessions ?? []).slice(0, 365);
  const preferences = payload.preferences ?? { focusMinutes: 25, breakMinutes: 5, autoPomodoro: false };
  const db = env.DB;

  const statements = [
    db.prepare("DELETE FROM tasks WHERE user_id = ?").bind(user.userId),
    db.prepare("DELETE FROM projects WHERE user_id = ?").bind(user.userId),
    db.prepare("DELETE FROM focus_sessions WHERE user_id = ?").bind(user.userId),
  ];

  for (const project of projects) {
    statements.push(db.prepare("INSERT INTO projects (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)").bind(String(project.id), user.userId, String(project.name).slice(0, 80), String(project.color).slice(0, 16), Number(project.createdAt)));
  }
  for (const task of tasks) {
    statements.push(db.prepare("INSERT INTO tasks (id, user_id, project_id, text, done, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(String(task.id), user.userId, String(task.projectId), String(task.text).slice(0, 240), task.done ? 1 : 0, Number(task.createdAt)));
  }
  for (const session of sessions) {
    statements.push(db.prepare("INSERT INTO focus_sessions (id, user_id, project_id, started_at, duration_seconds) VALUES (?, ?, ?, ?, ?)").bind(String(session.id), user.userId, String(session.projectId), Number(session.startedAt), Number(session.durationSeconds)));
  }
  statements.push(db.prepare("INSERT INTO user_preferences (user_id, focus_minutes, break_minutes, auto_pomodoro, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET focus_minutes = excluded.focus_minutes, break_minutes = excluded.break_minutes, auto_pomodoro = excluded.auto_pomodoro, updated_at = excluded.updated_at").bind(user.userId, Math.min(120, Math.max(1, Number(preferences.focusMinutes))), Math.min(60, Math.max(1, Number(preferences.breakMinutes))), preferences.autoPomodoro ? 1 : 0, Date.now()));

  await db.batch(statements);
  return Response.json({ ok: true, syncedAt: Date.now() });
}
