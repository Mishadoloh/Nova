import { apiContext, apiError, apiOk, cleanNumber, unauthorized } from "../backend";
import type { SearchEntity, SearchResult } from "../core/contracts";

type RawSearchRow = {
  id: string;
  type: SearchEntity;
  title: string;
  subtitle: string | null;
  color: string | null;
  timestamp: number | null;
  archived?: number | boolean;
  completed?: number | boolean;
};

const supportedTypes = new Set(["all", "project", "task", "event"]);

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeQuery(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function score(title: string, query: string, timestamp: number | null) {
  const normalizedTitle = title.toLocaleLowerCase("uk-UA");
  const normalizedQuery = query.toLocaleLowerCase("uk-UA");
  let relevance = 10;
  if (normalizedTitle === normalizedQuery) relevance = 100;
  else if (normalizedTitle.startsWith(normalizedQuery)) relevance = 75;
  else if (normalizedTitle.includes(` ${normalizedQuery}`)) relevance = 55;
  else if (normalizedTitle.includes(normalizedQuery)) relevance = 40;
  if (timestamp) {
    const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000);
    relevance += Math.max(0, 10 - Math.floor(ageDays / 7));
  }
  return relevance;
}

function hrefFor(row: RawSearchRow) {
  if (row.type === "project") return `/projects?project=${encodeURIComponent(row.id)}`;
  if (row.type === "task") return `/projects?task=${encodeURIComponent(row.id)}`;
  return `/calendar?event=${encodeURIComponent(row.id)}`;
}

function toResult(row: RawSearchRow, query: string): SearchResult {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle ?? (row.type === "project" ? "Проєкт NOVA" : ""),
    href: hrefFor(row),
    color: row.color,
    timestamp: row.timestamp,
    score: score(row.title, query, row.timestamp),
  };
}

export async function GET(request: Request) {
  const context = await apiContext();
  if (!context) return unauthorized();
  const url = new URL(request.url);
  const query = normalizeQuery(url.searchParams.get("q"));
  const requestedType = url.searchParams.get("type") ?? "all";
  const limit = Math.round(cleanNumber(url.searchParams.get("limit") ?? 20, 1, 50) ?? 20);
  if (query.length < 2) return apiError("QUERY_TOO_SHORT", "Введи щонайменше 2 символи", 422);
  if (!supportedTypes.has(requestedType)) return apiError("INVALID_TYPE", "Невідомий тип пошуку", 422);
  const like = `%${escapeLike(query)}%`;
  const perTypeLimit = Math.min(30, limit);
  const statements = [];
  const types: SearchEntity[] = requestedType === "all" ? ["project", "task", "event"] : [requestedType as SearchEntity];

  if (types.includes("project")) {
    statements.push(context.db.prepare(
      `SELECT
        id,
        'project' AS type,
        name AS title,
        CASE WHEN archived=1 THEN 'Архівний проєкт' ELSE 'Активний проєкт' END AS subtitle,
        color,
        updated_at AS timestamp,
        archived
      FROM projects
      WHERE user_id=? AND name LIKE ? ESCAPE '\\'
      ORDER BY archived, updated_at DESC
      LIMIT ?`,
    ).bind(context.user.userId, like, perTypeLimit));
  }

  if (types.includes("task")) {
    statements.push(context.db.prepare(
      `SELECT
        t.id,
        'task' AS type,
        t.text AS title,
        p.name || CASE WHEN t.status='done' THEN ' · виконано' WHEN t.status='doing' THEN ' · у роботі' ELSE ' · заплановано' END AS subtitle,
        p.color,
        t.updated_at AS timestamp,
        t.done AS completed
      FROM tasks t
      JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id
      WHERE t.user_id=? AND t.text LIKE ? ESCAPE '\\'
      ORDER BY t.done, t.updated_at DESC
      LIMIT ?`,
    ).bind(context.user.userId, like, perTypeLimit));
  }

  if (types.includes("event")) {
    statements.push(context.db.prepare(
      `SELECT
        e.id,
        'event' AS type,
        e.title,
        COALESCE(p.name,'Календар') || CASE WHEN e.completed=1 THEN ' · завершено' ELSE ' · заплановано' END AS subtitle,
        p.color,
        e.starts_at AS timestamp,
        e.completed
      FROM calendar_events e
      LEFT JOIN projects p ON p.id=e.project_id AND p.user_id=e.user_id
      WHERE e.user_id=? AND e.title LIKE ? ESCAPE '\\'
      ORDER BY e.completed, e.starts_at
      LIMIT ?`,
    ).bind(context.user.userId, like, perTypeLimit));
  }

  const batches = await context.db.batch(statements);
  const rows = batches.flatMap((batch) => batch.results as unknown as RawSearchRow[]);
  const results = rows.map((row) => toResult(row, query)).sort((a, b) => b.score - a.score || (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, limit);
  const counts = results.reduce<Record<SearchEntity, number>>((accumulator, result) => {
    accumulator[result.type] += 1;
    return accumulator;
  }, { project: 0, task: 0, event: 0 });
  return apiOk({ query, results, counts, total: results.length, generatedAt: Date.now() });
}
