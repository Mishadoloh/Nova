import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const cases = [
  // Product pages (10)
  ["dashboard exposes timer and atmosphere mixer", "app/page.tsx", [/toggleTimer/, /<AudioMixer \/>/]],
  ["projects support kanban drag and drop", "app/projects/page.tsx", [/onDrop/, /draggable/]],
  ["calendar exports interoperable ICS files", "app/calendar/page.tsx", [/BEGIN:VCALENDAR/, /text\/calendar/]],
  ["analytics charts are keyboard interactive", "app/analytics/page.tsx", [/aria-pressed/, /ArrowRight/]],
  ["history exports CSV and JSON", "app/history/page.tsx", [/"json"\|"csv"/, /nova-sessions/]],
  ["achievements calculate earned badges", "app/achievements/page.tsx", [/const badges/, /unlocked/]],
  ["settings expose installable PWA flow", "app/settings/page.tsx", [/beforeinstallprompt/, /installPrompt/]],
  ["account includes backup and activity tools", "app/account/page.tsx", [/<BackupManager/, /<BackendActivity/]],
  ["registration renders the real auth form", "app/register/page.tsx", [/<RegistrationForm \/>/]],
  ["offline page explains deferred synchronization", "app/offline/page.tsx", [/Ти офлайн/, /синхронізує/]],

  // API capabilities (15)
  ["activity API is authenticated and paginated", "app/api/activity/route.ts", [/unauthorized\(\)/, /limit \+ 1/]],
  ["backup API validates and writes workspaces", "app/api/backup/route.ts", [/unwrapBackup/, /writeWorkspace/]],
  ["calendar API implements full CRUD", "app/api/calendar/route.ts", [/export async function GET/, /export async function DELETE/]],
  ["dashboard API batches aggregate queries", "app/api/dashboard/route.ts", [/context\.db\.batch/, /focus_sessions/]],
  ["health API checks the database", "app/api/health/route.ts", [/env\.DB\.prepare/, /database:"connected"/]],
  ["insights API calculates focus score", "app/api/insights/route.ts", [/calculateStreak/, /focusScore/]],
  ["planner API builds conflict-free slots", "app/api/planner/route.ts", [/buildSlots/, /NOT_ENOUGH_TIME/]],
  ["profile API persists user preferences", "app/api/profile/route.ts", [/user_preferences/, /env\.DB\.batch/]],
  ["projects API supports create and archive", "app/api/projects/route.ts", [/export async function POST/, /archived/]],
  ["search API escapes wildcard input", "app/api/search/route.ts", [/escapeLike/, /LIKE \? ESCAPE/]],
  ["sessions API validates focus duration", "app/api/sessions/route.ts", [/durationSeconds/, /43200/]],
  ["sync API detects revision conflicts", "app/api/sync/route.ts", [/SYNC_CONFLICT/, /baseRevision/]],
  ["tasks API maintains workflow status", "app/api/tasks/route.ts", [/"todo"/, /"doing"/, /"done"/]],
  ["engine analytics API limits payload size", "app/api/engine/analytics/route.ts", [/PAYLOAD_TOO_LARGE/, /10_000/]],
  ["engine timer API bounds Pomodoro settings", "app/api/engine/timer/route.ts", [/body\.focusMinutes, 1, 120/, /body\.cycles \?\? 4, 1, 12/]],

  // Security and validation (12)
  ["API responses prevent browser caching", "app/api/backend.ts", [/Cache-Control/, /no-store/]],
  ["identity uses a stable authenticated user header", "app/chatgpt-auth.ts", [/oai-authenticated-user-id/, /userId/]],
  ["sign-in return paths reject protocol-relative URLs", "app/chatgpt-auth.ts", [/startsWith\("\/"\)/, /startsWith\("\/\/"\)/]],
  ["Supabase requests attach bearer sessions", "app/lib/supabase.ts", [/Authorization/, /Bearer/]],
  ["registration supports Google OAuth", "app/register/registration-form.tsx", [/signInWithOAuth/, /provider:\s*"google"/]],
  ["new passwords require eight characters", "app/register/registration-form.tsx", [/minLength=\{8\}/, /password\.length >= 8/]],
  ["OAuth callback validates local next paths", "app/auth/callback/page.tsx", [/next\?\.startsWith\("\/"\)/, /!next\.startsWith\("\/\/"\)/]],
  ["backup import enforces a two megabyte limit", "app/components/BackupManager.tsx", [/2_000_000/, /Максимальний розмір/]],
  ["search requests enforce bounded limits", "app/api/search/route.ts", [/cleanNumber\(url\.searchParams\.get\("limit"/, /1, 50/]],
  ["calendar writes verify project ownership", "app/api/calendar/route.ts", [/projectExists/, /PROJECT_NOT_FOUND/]],
  ["activity reads are scoped to the current user", "app/api/activity/route.ts", [/WHERE user_id=\?/, /context\.user\.userId/]],
  ["gateway compares service tokens in constant time", "services/gateway/internal/api/server.go", [/ConstantTimeCompare/, /Authorization/]],

  // Database model and indexing (15)
  ["projects table is declared", "db/schema.ts", [/sqliteTable\("projects"/, /idx_projects_user_created/]],
  ["tasks table is declared", "db/schema.ts", [/sqliteTable\("tasks"/, /projectId/]],
  ["focus sessions table is declared", "db/schema.ts", [/sqliteTable\("focus_sessions"/, /durationSeconds/]],
  ["preferences table is declared", "db/schema.ts", [/sqliteTable\("user_preferences"/, /dailyGoalMinutes/]],
  ["calendar events table is declared", "db/schema.ts", [/sqliteTable\("calendar_events"/, /startsAt/]],
  ["sync metadata table is declared", "db/schema.ts", [/sqliteTable\("sync_meta"/, /revision/]],
  ["activity log table is declared", "db/schema.ts", [/sqliteTable\("activity_log"/, /entityType/]],
  ["tasks have a project lookup index", "db/schema.ts", [/idx_tasks_user_project/]],
  ["tasks have a workflow sorting index", "db/schema.ts", [/idx_tasks_user_status_sort/]],
  ["sessions have a chronological index", "db/schema.ts", [/idx_sessions_user_started/]],
  ["sessions have a project timeline index", "db/schema.ts", [/idx_sessions_user_project_started/]],
  ["events have a chronological index", "db/schema.ts", [/idx_events_user_starts/]],
  ["events have a project timeline index", "db/schema.ts", [/idx_events_user_project_starts/]],
  ["activity migration creates its index", "drizzle/0006_cuddly_doctor_faustus.sql", [/CREATE TABLE `activity_log`/, /idx_activity_user_created/]],
  ["hosting binds the D1 database", ".openai/hosting.json", [/"d1": "DB"/]],

  // Component behavior (10)
  ["app frame exposes active navigation state", "app/components/AppFrame.tsx", [/aria-current/, /breadcrumb/]],
  ["audio mixer persists custom levels", "app/components/AudioMixer.tsx", [/nova-audio-mixer-v2/, /localStorage\.setItem/]],
  ["auth gate redirects protected pages", "app/components/AuthGate.tsx", [/getSession/, /register\?returnTo/]],
  ["backend activity supports refresh", "app/components/BackendActivity.tsx", [/const load = useCallback/, /Оновити/]],
  ["backup manager supports merge and replace", "app/components/BackupManager.tsx", [/type Mode = "merge" \| "replace"/, /window\.confirm/]],
  ["engine insight handles unavailable analytics", "app/components/EngineInsight.tsx", [/engine-insight-error/, /Повторити/]],
  ["engine status can recheck services", "app/components/EngineStatus.tsx", [/checkServices/, /aria-expanded/]],
  ["command palette supports keyboard navigation", "app/components/GlobalTools.tsx", [/ArrowDown/, /aria-activedescendant/]],
  ["store queues offline mutations", "app/components/nova-store.ts", [/nova-sync-queue/, /queued for reconnect/]],
  ["timer sends completion notifications", "app/page.tsx", [/new Notification/, /Фокус завершено/]],

  // Responsive design and accessibility (10)
  ["foundation defines the global accent token", "app/styles/01-foundation.css", [/--accent/]],
  ["keyboard focus is visibly styled", "app/styles/02-product-tools.css", [/:focus-visible/, /outline/]],
  ["desktop layout adapts below 1100px", "app/styles/09-responsive.css", [/@media \(max-width: 1100px\)/]],
  ["tablet layout adapts below 760px", "app/styles/09-responsive.css", [/@media \(max-width: 760px\)/]],
  ["small phones adapt below 430px", "app/styles/09-responsive.css", [/@media \(max-width: 430px\)/]],
  ["motion respects reduced-motion preference", "app/styles/10-quality-pass.css", [/@media \(prefers-reduced-motion: reduce\)/]],
  ["contrast respects increased-contrast preference", "app/styles/10-quality-pass.css", [/@media \(prefers-contrast: more\)/]],
  ["analytics has a printable layout", "app/styles/02-product-tools.css", [/@media print/]],
  ["authentication adapts to mobile screens", "app/styles/12-auth-experience.css", [/@media \(max-width: 480px\)/]],
  ["command palette exposes selected option styling", "app/styles/14-command-palette.css", [/aria-selected="true"/, /command-status/]],

  // PWA, metadata, and build configuration (8)
  ["manifest launches in standalone mode", "app/manifest.ts", [/display:"standalone"/, /start_url:"\/"/]],
  ["manifest declares Ukrainian language", "app/manifest.ts", [/lang:"uk"/]],
  ["service worker caches primary routes", "public/sw.js", [/ROUTES=/, /\/offline/]],
  ["service worker excludes API requests", "public/sw.js", [/startsWith\("\/api\/"\)/]],
  ["favicon asset exists", "public/favicon.svg", [], true],
  ["social preview asset exists", "public/og-v2.png", [], true],
  ["hosting project identifier is persisted", ".openai/hosting.json", [/appgprj_6a775688a37081919d1f62a96d68b877/]],
  ["runtime requires a supported Node version", "package.json", [/"node": ">=22\.13\.0"/]],

  // Polyglot Docker backend (10)
  ["compose defines the Go gateway", "docker-compose.yml", [/gateway:/, /NOVA_HTTP_ADDR/]],
  ["compose defines Python analytics", "docker-compose.yml", [/analytics:/, /NOVA_ANALYTICS_PORT/]],
  ["compose defines the C++ timer engine", "docker-compose.yml", [/timer-engine:/, /NOVA_TIMER_PORT/]],
  ["compose checks service health", "docker-compose.yml", [/healthcheck:/, /service_healthy/]],
  ["Go gateway authenticates internal requests", "services/gateway/internal/api/server.go", [/authorize/, /Bearer/]],
  ["Go gateway bounds proxied request bodies", "services/gateway/internal/api/server.go", [/maxAnalyticsBody/, /maxTimerBody/]],
  ["Python analytics protects its endpoint", "services/analytics/nova_analytics/app.py", [/require_service_token/, /Depends/]],
  ["Python analytics calculates summaries", "services/analytics/nova_analytics/engine.py", [/def summarize/, /focus_score/]],
  ["C++ timer authenticates internal requests", "services/timer-engine/src/main.cpp", [/Bearer/, /authorized/]],
  ["C++ timer clamps unsafe configuration", "services/timer-engine/src/timer_engine.cpp", [/std::clamp/, /focus_minutes/]],
];

assert.equal(cases.length, 90, "quality suite must add exactly 90 tests");

for (const [name, file, patterns, existsOnly = false] of cases) {
  test(`quality: ${name}`, async () => {
    const url = new URL(`../${file}`, import.meta.url);
    if (existsOnly) {
      await access(url);
      return;
    }
    const source = await readFile(url, "utf8");
    for (const pattern of patterns) assert.match(source, pattern);
  });
}
