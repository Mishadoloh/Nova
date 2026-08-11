import { env } from "cloudflare:workers";

export async function GET() {
  const started=performance.now();
  try { await env.DB.prepare("SELECT 1 AS healthy").first();return Response.json({ok:true,service:"nova-api",database:"connected",latencyMs:Math.round(performance.now()-started),timestamp:Date.now()},{headers:{"Cache-Control":"no-store"}}); }
  catch { return Response.json({ok:false,service:"nova-api",database:"unavailable",timestamp:Date.now()},{status:503,headers:{"Cache-Control":"no-store"}}); }
}
