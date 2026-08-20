import {
  apiContext,
  apiError,
  apiOk,
  bumpRevision,
  jsonBody,
  recordActivity,
  unauthorized,
} from "../backend";
import type { RestoreMode } from "../core/contracts";
import {
  createBackupEnvelope,
  isRecord,
  MAX_BACKUP_BYTES,
  unwrapBackup,
} from "../core/validation";
import {
  createBackupPreview,
  mergeWorkspace,
  readWorkspace,
  writeWorkspace,
} from "../core/workspace";

function restoreMode(value: unknown): RestoreMode | null {
  return value === "preview" || value === "merge" || value === "replace" ? value : null;
}

function contentDisposition() {
  const date = new Date().toISOString().slice(0, 10);
  return `attachment; filename="nova-backup-${date}.json"`;
}

export async function GET(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const workspace = await readWorkspace(context.db, context.user.userId);
  const envelope = createBackupEnvelope(workspace);
  const download = new URL(request.url).searchParams.get("download") === "1";
  if (download) {
    return new Response(JSON.stringify(envelope, null, 2), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": contentDisposition(),
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return apiOk({ backup: envelope, preview: createBackupPreview(workspace) });
}

export async function POST(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BACKUP_BYTES) return apiError("PAYLOAD_TOO_LARGE", "Максимальний розмір резервної копії — 2 МБ", 413);
  const body = await jsonBody(request, MAX_BACKUP_BYTES);
  if (!body) return apiError("INVALID_JSON", "Некоректний JSON", 400);
  const mode = restoreMode(body.mode ?? "preview");
  if (!mode) return apiError("INVALID_MODE", "Режим має бути preview, merge або replace", 422);
  const source = isRecord(body.backup) ? body.backup : isRecord(body.data) ? body.data : body;
  const validation = unwrapBackup(source);
  if (!validation.ok) return apiError("BACKUP_VALIDATION_ERROR", "Резервна копія не пройшла перевірку", 422, { issues: validation.issues });
  const imported = validation.value;
  const preview = createBackupPreview(imported);
  if (mode === "preview") return apiOk({ preview });
  const current = await readWorkspace(context.db, context.user.userId);
  const target = mode === "merge" ? mergeWorkspace(current, imported) : imported;
  const targetPreview = createBackupPreview(target);
  if (targetPreview.counts.total > 900) return apiError("RESTORE_LIMIT", "Після обʼєднання буде понад 900 записів", 422, { counts: targetPreview.counts });
  const restoredAt = await writeWorkspace(context.db, context.user.userId, target, mode);
  const sync = await bumpRevision(context.db, context.user.userId);
  await recordActivity(context.db, context.user.userId, {
    action: "restored",
    entityType: "workspace",
    label: mode === "merge" ? "Обʼєднано резервну копію" : "Відновлено резервну копію",
    metadata: { mode, ...targetPreview.counts, revision: sync.revision },
  });
  return apiOk({ mode, revision: sync.revision, restoredAt, counts: targetPreview.counts });
}
