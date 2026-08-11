import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type SyncPayload = {
  projects?: Array<{ id: string; name: string; color: string; deadline?: number | null; archived?: boolean; createdAt: number; updatedAt?: number }>;
  tasks?: Array<{ id: string; projectId: string; text: string; done: boolean; status?: string; deadline?: number | null; recurrence?: string | null; sortOrder?: number; createdAt: number; updatedAt?: number }>;
  sessions?: Array<{ id: string; projectId: string; startedAt: number; durationSeconds: number }>;
  events?: Array<{ id: string; projectId?: string | null; title: string; startsAt: number; durationMinutes: number; recurrence?: string | null; completed?: boolean; createdAt: number; updatedAt?: number }>;
  preferences?: { focusMinutes: number; breakMinutes: number; autoPomodoro: boolean; dailyGoalMinutes?: number; activeProjectId?: string | null; timerMode?: "focus" | "break" };
  baseRevision?: number;
  force?: boolean;
};

async function readUserData(userId: string) {
  const db=env.DB;
  const [projectRows,taskRows,sessionRows,eventRows,preferenceRows,metaRows]=await db.batch([
    db.prepare("SELECT id,name,color,deadline,archived,created_at AS createdAt,updated_at AS updatedAt FROM projects WHERE user_id=? ORDER BY archived,created_at").bind(userId),
    db.prepare("SELECT id,project_id AS projectId,text,done,status,deadline,recurrence,sort_order AS sortOrder,created_at AS createdAt,updated_at AS updatedAt FROM tasks WHERE user_id=? ORDER BY sort_order,created_at").bind(userId),
    db.prepare("SELECT id,project_id AS projectId,started_at AS startedAt,duration_seconds AS durationSeconds FROM focus_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 1000").bind(userId),
    db.prepare("SELECT id,project_id AS projectId,title,starts_at AS startsAt,duration_minutes AS durationMinutes,recurrence,completed,created_at AS createdAt,updated_at AS updatedAt FROM calendar_events WHERE user_id=? ORDER BY starts_at").bind(userId),
    db.prepare("SELECT focus_minutes AS focusMinutes,break_minutes AS breakMinutes,auto_pomodoro AS autoPomodoro,daily_goal_minutes AS dailyGoalMinutes,active_project_id AS activeProjectId,timer_mode AS timerMode FROM user_preferences WHERE user_id=?").bind(userId),
    db.prepare("SELECT revision,updated_at AS updatedAt FROM sync_meta WHERE user_id=?").bind(userId),
  ]);
  return { projects:projectRows.results.map(item=>({...item,archived:Boolean(item.archived)})), tasks:taskRows.results.map(item=>({...item,done:Boolean(item.done)})), sessions:sessionRows.results, events:eventRows.results.map(item=>({...item,completed:Boolean(item.completed)})), preferences:preferenceRows.results[0]?{...preferenceRows.results[0],autoPomodoro:Boolean(preferenceRows.results[0].autoPomodoro)}:null, revision:Number(metaRows.results[0]?.revision??0), updatedAt:Number(metaRows.results[0]?.updatedAt??0) };
}

export async function GET() {
  const user=await getChatGPTUser(); if (!user) return Response.json({error:"Authentication required"},{status:401});
  return Response.json({user:{displayName:user.displayName,email:user.email},...(await readUserData(user.userId))});
}

export async function POST(request: Request) {
  const user=await getChatGPTUser(); if (!user) return Response.json({error:"Authentication required"},{status:401});
  const payload=(await request.json()) as SyncPayload; const db=env.DB;
  const current=await db.prepare("SELECT revision FROM sync_meta WHERE user_id=?").bind(user.userId).first<{revision:number}>();
  const currentRevision=Number(current?.revision??0);
  if (!payload.force && payload.baseRevision !== undefined && payload.baseRevision < currentRevision) return Response.json({error:"SYNC_CONFLICT",revision:currentRevision},{status:409});
  const projects=(payload.projects??[]).slice(0,100), tasks=(payload.tasks??[]).slice(0,2000), sessions=(payload.sessions??[]).slice(0,1000), events=(payload.events??[]).slice(0,1000);
  const preferences=payload.preferences??{focusMinutes:25,breakMinutes:5,autoPomodoro:false,dailyGoalMinutes:120,activeProjectId:null,timerMode:"focus"}; const timestamp=Date.now(); const nextRevision=currentRevision+1;
  const statements=[db.prepare("DELETE FROM tasks WHERE user_id=?").bind(user.userId),db.prepare("DELETE FROM projects WHERE user_id=?").bind(user.userId),db.prepare("DELETE FROM focus_sessions WHERE user_id=?").bind(user.userId)];
  if(payload.events!==undefined)statements.push(db.prepare("DELETE FROM calendar_events WHERE user_id=?").bind(user.userId));
  projects.forEach(item=>statements.push(db.prepare("INSERT INTO projects (id,user_id,name,color,deadline,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(String(item.id),user.userId,String(item.name).slice(0,80),String(item.color).slice(0,16),item.deadline??null,item.archived?1:0,Number(item.createdAt),Number(item.updatedAt??timestamp))));
  tasks.forEach(item=>statements.push(db.prepare("INSERT INTO tasks (id,user_id,project_id,text,done,status,deadline,recurrence,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(String(item.id),user.userId,String(item.projectId),String(item.text).slice(0,240),item.done?1:0,String(item.status??(item.done?"done":"todo")),item.deadline??null,item.recurrence??null,Number(item.sortOrder??0),Number(item.createdAt),Number(item.updatedAt??timestamp))));
  sessions.forEach(item=>statements.push(db.prepare("INSERT INTO focus_sessions (id,user_id,project_id,started_at,duration_seconds) VALUES (?,?,?,?,?)").bind(String(item.id),user.userId,String(item.projectId),Number(item.startedAt),Number(item.durationSeconds))));
  if(payload.events!==undefined)events.forEach(item=>statements.push(db.prepare("INSERT INTO calendar_events (id,user_id,project_id,title,starts_at,duration_minutes,recurrence,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(String(item.id),user.userId,item.projectId??null,String(item.title).slice(0,160),Number(item.startsAt),Number(item.durationMinutes),item.recurrence??null,item.completed?1:0,Number(item.createdAt),Number(item.updatedAt??timestamp))));
  statements.push(db.prepare("INSERT INTO user_preferences (user_id,focus_minutes,break_minutes,auto_pomodoro,daily_goal_minutes,active_project_id,timer_mode,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET focus_minutes=excluded.focus_minutes,break_minutes=excluded.break_minutes,auto_pomodoro=excluded.auto_pomodoro,daily_goal_minutes=excluded.daily_goal_minutes,active_project_id=excluded.active_project_id,timer_mode=excluded.timer_mode,updated_at=excluded.updated_at").bind(user.userId,Math.min(120,Math.max(1,Number(preferences.focusMinutes))),Math.min(60,Math.max(1,Number(preferences.breakMinutes))),preferences.autoPomodoro?1:0,Math.min(720,Math.max(15,Number(preferences.dailyGoalMinutes??120))),preferences.activeProjectId?String(preferences.activeProjectId).slice(0,120):null,preferences.timerMode==="break"?"break":"focus",timestamp));
  statements.push(db.prepare("INSERT INTO sync_meta (user_id,revision,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,updated_at=excluded.updated_at").bind(user.userId,nextRevision,timestamp));
  await db.batch(statements); return Response.json({ok:true,syncedAt:timestamp,revision:nextRevision});
}
