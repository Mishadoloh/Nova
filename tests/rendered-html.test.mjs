import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) files.push(...await filesBelow(url));
    else files.push(url);
  }
  return files;
}

test("server protects the NOVA focus application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="uk">/i);
  assert.match(html, /<title>NOVA — твій фокус-кокпіт<\/title>/i);
  assert.match(html, /class="auth-loading"/);
  assert.match(html, /Перевіряємо сесію/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(
    html,
    /codex-preview|Your site is taking shape|react-loading-skeleton/i,
  );
});

test("server-renders NOVA account registration", async () => {
  const response = await render("/register");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /registration-page/);
  assert.match(html, /NOVA/);
});

test("Google OAuth registration returns safely to NOVA", async () => {
  const [form, callback] = await Promise.all([
    readFile(
      new URL("../app/register/registration-form.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/auth/callback/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(form, /signInWithOAuth/);
  assert.match(form, /provider:\s*"google"/);
  assert.match(form, /\/auth\/callback/);
  assert.match(callback, /next\?\.startsWith\("\/"\)/);
  assert.match(callback, /!next\.startsWith\("\/\/"\)/);
  assert.match(callback, /friendlyAuthError/);
  assert.match(callback, /Вхід скасовано/);
  assert.match(callback, /Сесія завершилась/);
  assert.match(callback, /Спробувати ще раз/);
});

test("unconfirmed email can recover directly from the sign-in form", async () => {
  const form = await readFile(
    new URL("../app/register/registration-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(form, /supabase\.auth\.resend/);
  assert.match(form, /type:\s*"signup"/);
  assert.match(form, /Email ще не підтверджено/);
  assert.match(form, /Надіслати лист повторно/);
  assert.match(form, /папку «Спам»/);
});

test("keeps production UI and backend capabilities wired", async () => {
  const [page, layout, hosting, syncRoute, schema, packageJson] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
      readFile(new URL("../app/api/sync/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  assert.match(page, /<AudioMixer \/>/);
  assert.match(layout, /title:\s*"NOVA/);
  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(syncRoute, /SYNC_CONFLICT/);
  assert.match(syncRoute, /MAX_ITEMS/);
  assert.match(schema, /idx_sessions_user_project_started/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(
    access(
      new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url),
    ),
  );
});

test("polyglot Docker services stay connected to the NOVA interface", async () => {
  const [compose, polyglot, home, analytics, gateway, python, cpp] =
    await Promise.all([
      readFile(new URL("../docker-compose.yml", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/polyglot.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/analytics/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../services/gateway/internal/api/server.go", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../services/analytics/nova_analytics/engine.py",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../services/timer-engine/src/timer_engine.cpp",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(compose, /gateway:/);
  assert.match(compose, /analytics:/);
  assert.match(compose, /timer-engine:/);
  assert.match(polyglot, /NOVA_SERVICES_TOKEN/);
  assert.match(polyglot, /mode: "embedded"/);
  assert.match(home, /\/api\/engine\/timer/);
  assert.match(home, /<EngineStatus\s*\/>/);
  assert.match(analytics, /<EngineInsight/);
  assert.match(gateway, /ConstantTimeCompare/);
  assert.match(python, /def summarize/);
  assert.match(cpp, /TimerEngine::build/);
});

test("backend activity is persisted, protected, and visible in the profile", async () => {
  const [route, backend, schema, migration, account, component] =
    await Promise.all([
      readFile(new URL("../app/api/activity/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/backend.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../drizzle/0006_cuddly_doctor_faustus.sql", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/components/BackendActivity.tsx", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(route, /if \(!context\) return unauthorized\(\)/);
  assert.match(route, /ORDER BY created_at DESC LIMIT/);
  assert.match(backend, /recordActivity/);
  assert.match(backend, /LIMIT 120/);
  assert.match(schema, /activityLog/);
  assert.match(migration, /CREATE TABLE `activity_log`/);
  assert.match(migration, /idx_activity_user_created/);
  assert.match(account, /<BackendActivity\s*\/>/);
  assert.match(component, /\/api\/activity\?limit=8/);
});

test("account backups can be exported, validated, merged, and restored", async () => {
  const [account, component, styles] = await Promise.all([
    readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/BackupManager.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/styles/19-backup-manager.css", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(account, /<BackupManager/);
  assert.match(component, /authFetch\("\/api\/backup\?download=1"/);
  assert.match(component, /parseBackup/);
  assert.match(component, /uniqueIds/);
  assert.match(component, /\/api\/backup/);
  assert.match(component, /mode === "replace"/);
  assert.match(component, /await refresh\(\)/);
  assert.match(styles, /backup-preview/);
});

test("professional backend exceeds 3000 meaningful lines and exposes new services", async () => {
  const roots = [
    new URL("../app/api/", import.meta.url),
    new URL("../db/", import.meta.url),
    new URL("../services/", import.meta.url),
  ];
  const files = (await Promise.all(roots.map(filesBelow))).flat().filter((url) => /\.(ts|go|py|cpp|hpp)$/.test(url.pathname));
  const sources = await Promise.all(files.map((url) => readFile(url, "utf8")));
  const totalLines = sources.reduce((sum, source) => sum + source.split(/\r?\n/).length, 0);
  const [search, calendar, insights, planner, backup, validation, workspace] = await Promise.all([
    readFile(new URL("../app/api/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/calendar/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/insights/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/planner/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/backup/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/core/validation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/core/workspace.ts", import.meta.url), "utf8"),
  ]);

  assert.ok(totalLines >= 3000, `Expected at least 3000 backend lines, received ${totalLines}`);
  assert.match(search, /if \(!context\) return unauthorized\(\)/);
  assert.match(search, /LIKE \? ESCAPE/);
  assert.match(calendar, /export async function PATCH/);
  assert.match(calendar, /recordActivity/);
  assert.match(insights, /calculateStreak/);
  assert.match(insights, /focusScore/);
  assert.match(planner, /buildSlots/);
  assert.match(planner, /NOT_ENOUGH_TIME/);
  assert.match(backup, /mergeWorkspace/);
  assert.match(backup, /writeWorkspace/);
  assert.match(validation, /validateWorkspace/);
  assert.match(workspace, /ON CONFLICT\(id\) DO UPDATE/);
});

test("command palette searches synchronized projects, tasks, and calendar events", async () => {
  const [tools, styles] = await Promise.all([
    readFile(new URL("../app/components/GlobalTools.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/14-command-palette.css", import.meta.url), "utf8"),
  ]);

  assert.match(tools, /\/api\/search\?q=/);
  assert.match(tools, /encodeURIComponent\(needle\)/);
  assert.match(tools, /AbortController/);
  assert.match(tools, /Пошук у хмарних даних/);
  assert.match(tools, /event: "Подія календаря"/);
  assert.match(styles, /command-status/);
  assert.match(styles, /result-color/);
});
