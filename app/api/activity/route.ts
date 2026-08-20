import { apiContext, apiError, apiOk, cleanNumber, unauthorized } from "../backend";

type ActivityRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  label: string;
  metadata: string | null;
  createdAt: number;
};

function safeMetadata(value: string | null) {
  if (!value) return null;
  try { return JSON.parse(value) as Record<string, unknown>; }
  catch { return null; }
}

export async function GET(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const url = new URL(request.url);
  const limit = Math.round(cleanNumber(url.searchParams.get("limit") ?? 12, 1, 50) ?? 12);
  const before = cleanNumber(url.searchParams.get("before") ?? Date.now() + 1, 0, 8_640_000_000_000_000) ?? Date.now() + 1;
  const rows = await context.db.prepare(
    "SELECT id,action,entity_type AS entityType,entity_id AS entityId,label,metadata,created_at AS createdAt FROM activity_log WHERE user_id=? AND created_at<? ORDER BY created_at DESC LIMIT ?",
  ).bind(context.user.userId, before, limit + 1).all<ActivityRow>();
  const hasMore = rows.results.length > limit;
  const items = rows.results.slice(0, limit).map((item) => ({ ...item, metadata: safeMetadata(item.metadata) }));
  return apiOk({ items, hasMore, nextCursor: hasMore ? items.at(-1)?.createdAt ?? null : null });
}

export async function DELETE() {
  const context = await apiContext();
  if (!context) return unauthorized();
  const result = await context.db.prepare("DELETE FROM activity_log WHERE user_id=?").bind(context.user.userId).run();
  if (!result.success) return apiError("ACTIVITY_CLEAR_FAILED", "Не вдалося очистити журнал", 500);
  return apiOk({ deleted: Number(result.meta.changes ?? 0) });
}
