import { apiContext, apiError, apiOk, bumpRevision, cleanId, cleanNumber, cleanText, jsonBody, recordActivity, unauthorized } from "../backend";

export async function GET() {
  const context=await apiContext();if(!context)return unauthorized();
  const rows=await context.db.prepare("SELECT id,name,color,deadline,archived,created_at AS createdAt,updated_at AS updatedAt FROM projects WHERE user_id=? ORDER BY archived,created_at").bind(context.user.userId).all();
  return apiOk(rows.results.map(item=>({...item,archived:Boolean(item.archived)})));
}

export async function POST(request:Request) {
  const context=await apiContext();if(!context)return unauthorized();const body=await jsonBody(request);if(!body)return apiError("INVALID_JSON","Некоректний JSON");
  const id=cleanId(body.id),name=cleanText(body.name,80),color=/^#[0-9a-fA-F]{6}$/.test(String(body.color??""))?String(body.color):"#dfff00";
  if(!id||!name)return apiError("VALIDATION_ERROR","Потрібні коректні id та назва",422);
  const exists=await context.db.prepare("SELECT 1 FROM projects WHERE id=?").bind(id).first();if(exists)return apiError("PROJECT_EXISTS","Проєкт із таким id уже існує",409);
  const timestamp=Date.now(),deadline=body.deadline==null?null:cleanNumber(body.deadline,0,8640000000000000);
  await context.db.prepare("INSERT INTO projects (id,user_id,name,color,deadline,archived,created_at,updated_at) VALUES (?,?,?,?,?,0,?,?)").bind(id,context.user.userId,name,color,deadline,timestamp,timestamp).run();
  const sync=await bumpRevision(context.db,context.user.userId);await recordActivity(context.db,context.user.userId,{action:"created",entityType:"project",entityId:id,label:`Створено проєкт «${name}»`,metadata:{color}});return apiOk({id,name,color,deadline,archived:false,createdAt:timestamp,updatedAt:timestamp,sync},201);
}

export async function PATCH(request:Request) {
  const context=await apiContext();if(!context)return unauthorized();const body=await jsonBody(request);if(!body)return apiError("INVALID_JSON","Некоректний JSON");const id=cleanId(body.id);if(!id)return apiError("VALIDATION_ERROR","Некоректний id",422);
  const current=await context.db.prepare("SELECT name,color,deadline,archived FROM projects WHERE id=? AND user_id=?").bind(id,context.user.userId).first<Record<string,unknown>>();if(!current)return apiError("NOT_FOUND","Проєкт не знайдено",404);
  const name=body.name===undefined?String(current.name):cleanText(body.name,80),color=body.color===undefined?String(current.color):/^#[0-9a-fA-F]{6}$/.test(String(body.color))?String(body.color):null;
  if(!name||!color)return apiError("VALIDATION_ERROR","Некоректна назва або колір",422);const deadline=body.deadline===undefined?current.deadline:body.deadline===null?null:cleanNumber(body.deadline,0,8640000000000000),archived=body.archived===undefined?Boolean(current.archived):Boolean(body.archived),updatedAt=Date.now();
  await context.db.prepare("UPDATE projects SET name=?,color=?,deadline=?,archived=?,updated_at=? WHERE id=? AND user_id=?").bind(name,color,deadline,archived?1:0,updatedAt,id,context.user.userId).run();const sync=await bumpRevision(context.db,context.user.userId);await recordActivity(context.db,context.user.userId,{action:archived?"archived":"updated",entityType:"project",entityId:id,label:archived?`Архівовано проєкт «${name}»`:`Оновлено проєкт «${name}»`,metadata:{color}});
  return apiOk({id,name,color,deadline,archived,updatedAt,sync});
}
