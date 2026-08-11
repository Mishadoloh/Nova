import { apiContext, apiOk, unauthorized } from "../backend";

export async function GET(request:Request) {
  const context=await apiContext();if(!context)return unauthorized();const days=Math.min(90,Math.max(7,Number(new URL(request.url).searchParams.get("days")??14))),from=Date.now()-days*86400000;
  const [summary,daily,projects]=await context.db.batch([
    context.db.prepare("SELECT COUNT(*) AS sessions,COALESCE(ROUND(SUM(duration_seconds)/60.0),0) AS minutes,COALESCE(ROUND(AVG(duration_seconds)/60.0),0) AS averageMinutes,COALESCE(ROUND(MAX(duration_seconds)/60.0),0) AS longestMinutes FROM focus_sessions WHERE user_id=? AND started_at>=?").bind(context.user.userId,from),
    context.db.prepare("SELECT strftime('%Y-%m-%d',started_at/1000,'unixepoch') AS date,COUNT(*) AS sessions,ROUND(SUM(duration_seconds)/60.0) AS minutes FROM focus_sessions WHERE user_id=? AND started_at>=? GROUP BY date ORDER BY date").bind(context.user.userId,from),
    context.db.prepare("SELECT p.id,p.name,p.color,COUNT(s.id) AS sessions,COALESCE(ROUND(SUM(s.duration_seconds)/60.0),0) AS minutes FROM projects p LEFT JOIN focus_sessions s ON s.project_id=p.id AND s.started_at>=? WHERE p.user_id=? GROUP BY p.id,p.name,p.color ORDER BY minutes DESC").bind(from,context.user.userId),
  ]);
  return apiOk({ periodDays:days, generatedAt:Date.now(), summary:summary.results[0]??{sessions:0,minutes:0,averageMinutes:0,longestMinutes:0}, daily:daily.results, projects:projects.results });
}
