import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { apiError, apiOk, cleanNumber, cleanText, jsonBody, unauthorized } from "../backend";

const areas = new Set(["work", "study", "personal"]);

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();
  const profile = await env.DB.prepare("SELECT display_name AS displayName,focus_area AS focusArea,timezone,created_at AS createdAt,updated_at AS updatedAt FROM user_profiles WHERE user_id=?").bind(user.userId).first();
  return apiOk({ registered: Boolean(profile), profile, identity: { displayName: user.displayName, email: user.email } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();
  const body = await jsonBody(request, 20_000);
  if (!body) return apiError("INVALID_JSON", "Некоректний запит", 400);
  const displayName = cleanText(body.displayName, 60);
  const focusArea = areas.has(String(body.focusArea)) ? String(body.focusArea) : null;
  const dailyGoalMinutes = cleanNumber(body.dailyGoalMinutes, 15, 720);
  const timezone = cleanText(body.timezone, 64);
  if (!displayName || !focusArea || dailyGoalMinutes === null || !timezone) return apiError("VALIDATION_ERROR", "Перевір імʼя, напрям і денну ціль", 422);

  const now = Date.now();
  const existingProfile = await env.DB.prepare("SELECT created_at AS createdAt FROM user_profiles WHERE user_id=?").bind(user.userId).first<{ createdAt: number }>();
  const existingProject = await env.DB.prepare("SELECT id FROM projects WHERE user_id=? ORDER BY created_at LIMIT 1").bind(user.userId).first<{ id: string }>();
  const projectId = existingProject?.id ?? `project-${crypto.randomUUID()}`;
  const projectNames: Record<string, string> = { work: "Головний проєкт", study: "Навчання", personal: "Особисті цілі" };
  const statements = [
    env.DB.prepare("INSERT INTO user_profiles (user_id,display_name,focus_area,timezone,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,focus_area=excluded.focus_area,timezone=excluded.timezone,updated_at=excluded.updated_at").bind(user.userId, displayName, focusArea, timezone, existingProfile?.createdAt ?? now, now),
    env.DB.prepare("INSERT INTO user_preferences (user_id,focus_minutes,break_minutes,auto_pomodoro,daily_goal_minutes,active_project_id,timer_mode,updated_at) VALUES (?,25,5,0,?,?,'focus',?) ON CONFLICT(user_id) DO UPDATE SET daily_goal_minutes=excluded.daily_goal_minutes,active_project_id=COALESCE(user_preferences.active_project_id,excluded.active_project_id),updated_at=excluded.updated_at").bind(user.userId, dailyGoalMinutes, projectId, now),
    env.DB.prepare("INSERT INTO sync_meta (user_id,revision,updated_at) VALUES (?,1,?) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1,updated_at=excluded.updated_at").bind(user.userId, now),
  ];
  if (!existingProject) statements.splice(1, 0, env.DB.prepare("INSERT INTO projects (id,user_id,name,color,deadline,archived,created_at,updated_at) VALUES (?,?,?,'#dfff00',NULL,0,?,?)").bind(projectId, user.userId, projectNames[focusArea], now, now));
  await env.DB.batch(statements);
  return apiOk({ registered: true, created: !existingProfile, profile: { displayName, focusArea, timezone, createdAt: existingProfile?.createdAt ?? now, updatedAt: now }, projectId }, existingProfile ? 200 : 201);
}
