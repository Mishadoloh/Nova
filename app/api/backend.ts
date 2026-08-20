import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../chatgpt-auth";

export async function apiContext() {
  const user = await getChatGPTUser();
  return user ? { user, db: env.DB } : null;
}

export function apiError(code:string,message:string,status=400,details?:Record<string,unknown>) {
  return Response.json({ ok:false, error:{ code, message, ...details } },{ status, headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"} });
}

export function apiOk<T>(data:T,status=200) {
  return Response.json({ ok:true, data },{ status, headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"} });
}

export async function jsonBody(request:Request,maxBytes=1_000_000) {
  const declared=Number(request.headers.get("content-length")??0);
  if(Number.isFinite(declared)&&declared>maxBytes)return null;
  try { const value=await request.json(); return value&&typeof value==="object"?value as Record<string,unknown>:null; }
  catch { return null; }
}

export function cleanId(value:unknown) {
  const result=String(value??"").trim();
  return /^[a-zA-Z0-9_-]{3,120}$/.test(result)?result:null;
}

export function cleanText(value:unknown,max=240) {
  const result=String(value??"").trim().replace(/\s+/g," ");
  return result&&result.length<=max?result:null;
}

export function cleanNumber(value:unknown,min:number,max:number) {
  const result=Number(value);
  return Number.isFinite(result)?Math.min(max,Math.max(min,result)):null;
}

export async function bumpRevision(db:typeof env.DB,userId:string) {
  const timestamp=Date.now();
  await db.prepare("INSERT INTO sync_meta (user_id,revision,updated_at) VALUES (?,1,?) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1,updated_at=excluded.updated_at").bind(userId,timestamp).run();
  const row=await db.prepare("SELECT revision FROM sync_meta WHERE user_id=?").bind(userId).first<{revision:number}>();
  return { revision:Number(row?.revision??1), updatedAt:timestamp };
}

export async function recordActivity(
  db: typeof env.DB,
  userId: string,
  activity: {
    action: string;
    entityType: string;
    entityId?: string | null;
    label: string;
    metadata?: Record<string, unknown>;
  },
) {
  const action = cleanText(activity.action, 40);
  const entityType = cleanText(activity.entityType, 40);
  const label = cleanText(activity.label, 160);
  if (!action || !entityType || !label) return;
  const metadata = activity.metadata
    ? JSON.stringify(activity.metadata).slice(0, 1_500)
    : null;
  try {
    await db.batch([
      db.prepare("INSERT INTO activity_log (id,user_id,action,entity_type,entity_id,label,metadata,created_at) VALUES (?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), userId, action, entityType, activity.entityId ?? null, label, metadata, Date.now()),
      db.prepare("DELETE FROM activity_log WHERE user_id=? AND id NOT IN (SELECT id FROM activity_log WHERE user_id=? ORDER BY created_at DESC LIMIT 120)")
        .bind(userId, userId),
    ]);
  } catch {
    // Activity history is useful but must never block the primary user action.
  }
}

export function unauthorized() {
  return apiError("AUTH_REQUIRED","Потрібна авторизація через ChatGPT",401);
}
