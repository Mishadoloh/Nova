# NOVA backend API

All product endpoints use the authenticated ChatGPT user supplied by Sites and
scope every query by `user_id`. Responses use `{ ok, data }` on success and
`{ ok: false, error: { code, message } }` on failure.

## Endpoints

- `GET /api/health` — runtime and database health.
- `GET /api/dashboard?days=14` — server-computed focus analytics.
- `GET|POST|PATCH /api/projects` — list, create and update projects.
- `GET|POST|PATCH|DELETE /api/tasks` — task CRUD with project ownership checks.
- `GET|POST|DELETE /api/sessions` — filtered session history and idempotent writes.
- `GET|POST /api/sync` — offline-first bulk synchronization and conflict merging.

Every mutation increments the same server revision used by the offline sync
protocol. Inputs are bounded and validated before prepared SQL statements run.
