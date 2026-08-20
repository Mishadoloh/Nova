import { apiContext, apiError, apiOk, bumpRevision, cleanId, cleanNumber, cleanText, jsonBody, recordActivity, unauthorized } from "../backend";

const statuses=["todo","doing","done"] as const;
function status(value:unknown){return statuses.includes(value as typeof statuses[number])?value as typeof statuses[number]:null}

export async function GET(request:Request) {
  const context=await apiContext();if(!context)return unauthorized();const url=new URL(request.url),projectId=cleanId(url.searchParams.get("projectId")),selected=status(url.searchParams.get("status"));let query="SELECT id,project_id AS projectId,text,done,status,deadline,recurrence,sort_order AS sortOrder,created_at AS createdAt,updated_at AS updatedAt FROM tasks WHERE user_id=?";const values:unknown[]=[context.user.userId];
  if(projectId){query+=" AND project_id=?";values.push(projectId)}if(selected){query+=" AND status=?";values.push(selected)}query+=" ORDER BY sort_order,created_at";
  const rows=await context.db.prepare(query).bind(...values).all();return apiOk(rows.results.map(item=>({...item,done:Boolean(item.done)})));
}

export async function POST(request:Request) {
  const context=await apiContext();if(!context)return unauthorized();const body=await jsonBody(request);if(!body)return apiError("INVALID_JSON","Некоректний JSON");const id=cleanId(body.id),projectId=cleanId(body.projectId),text=cleanText(body.text),selected=status(body.status??"todo");if(!id||!projectId||!text||!selected)return apiError("VALIDATION_ERROR","Некоректні дані задачі",422);
  const project=await context.db.prepare("SELECT 1 FROM projects WHERE id=? AND user_id=?").bind(projectId,context.user.userId).first();if(!project)return apiError("PROJECT_NOT_FOUND","Проєкт не знайдено",404);const exists=await context.db.prepare("SELECT 1 FROM tasks WHERE id=?").bind(id).first();if(exists)return apiError("TASK_EXISTS","Задача з таким id уже існує",409);
  const timestamp=Date.now(),deadline=body.deadline==null?null:cleanNumber(body.deadline,0,8640000000000000),recurrence=body.recurrence==null?null:cleanText(body.recurrence,32),sortOrder=cleanNumber(body.sortOrder??0,0,100000)??0,done=selected==="done";
  await context.db.prepare("INSERT INTO tasks (id,user_id,project_id,text,done,status,deadline,recurrence,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id,context.user.userId,projectId,text,done?1:0,selected,deadline,recurrence,sortOrder,timestamp,timestamp).run();const sync=await bumpRevision(context.db,context.user.userId);await recordActivity(context.db,context.user.userId,{action:"created",entityType:"task",entityId:id,label:`Створено задачу «${text}»`,metadata:{projectId,status:selected}});
  return apiOk({id,projectId,text,done,status:selected,deadline,recurrence,sortOrder,createdAt:timestamp,updatedAt:timestamp,sync},201);
}

export async function PATCH(request:Request) {
  const context=await apiContext();if(!context)return unauthorized();const body=await jsonBody(request);if(!body)return apiError("INVALID_JSON","Некоректний JSON");const id=cleanId(body.id);if(!id)return apiError("VALIDATION_ERROR","Некоректний id",422);const current=await context.db.prepare("SELECT project_id AS projectId,text,status,deadline,recurrence,sort_order AS sortOrder FROM tasks WHERE id=? AND user_id=?").bind(id,context.user.userId).first<Record<string,unknown>>();if(!current)return apiError("NOT_FOUND","Задачу не знайдено",404);
  const text=body.text===undefined?String(current.text):cleanText(body.text),selected=body.status===undefined?status(current.status):status(body.status),deadline=body.deadline===undefined?current.deadline:body.deadline===null?null:cleanNumber(body.deadline,0,8640000000000000),recurrence=body.recurrence===undefined?current.recurrence:body.recurrence===null?null:cleanText(body.recurrence,32),sortOrder=body.sortOrder===undefined?Number(current.sortOrder):cleanNumber(body.sortOrder,0,100000);if(!text||!selected||sortOrder===null)return apiError("VALIDATION_ERROR","Некоректні дані задачі",422);const updatedAt=Date.now();
  await context.db.prepare("UPDATE tasks SET text=?,done=?,status=?,deadline=?,recurrence=?,sort_order=?,updated_at=? WHERE id=? AND user_id=?").bind(text,selected==="done"?1:0,selected,deadline,recurrence,sortOrder,updatedAt,id,context.user.userId).run();const sync=await bumpRevision(context.db,context.user.userId);await recordActivity(context.db,context.user.userId,{action:"updated",entityType:"task",entityId:id,label:selected==="done"?`Завершено задачу «${text}»`:`Оновлено задачу «${text}»`,metadata:{status:selected}});return apiOk({id,text,done:selected==="done",status:selected,deadline,recurrence,sortOrder,updatedAt,sync});
}

export async function DELETE(request:Request) {
  const context=await apiContext();if(!context)return unauthorized();const id=cleanId(new URL(request.url).searchParams.get("id"));if(!id)return apiError("VALIDATION_ERROR","Некоректний id",422);const current=await context.db.prepare("SELECT text FROM tasks WHERE id=? AND user_id=?").bind(id,context.user.userId).first<{text:string}>();const result=await context.db.prepare("DELETE FROM tasks WHERE id=? AND user_id=?").bind(id,context.user.userId).run();if(!result.meta.changes)return apiError("NOT_FOUND","Задачу не знайдено",404);const sync=await bumpRevision(context.db,context.user.userId);await recordActivity(context.db,context.user.userId,{action:"deleted",entityType:"task",entityId:id,label:`Видалено задачу «${current?.text??"Без назви"}»`});return apiOk({id,deleted:true,sync});
}
