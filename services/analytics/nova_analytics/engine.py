from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from .models import AnalyticsRequest, AnalyticsSummary, ProjectShare, Session

MILLISECONDS_PER_DAY = 86_400_000


def _local_datetime(timestamp_ms: int, offset_minutes: int) -> datetime:
    utc_value = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
    return utc_value - timedelta(minutes=offset_minutes)


def _minutes(sessions: list[Session]) -> int:
    return round(sum(item.duration_seconds for item in sessions) / 60)


def _streak(sessions: list[Session], now_ms: int, offset_minutes: int) -> int:
    active_dates = {
        _local_datetime(item.started_at, offset_minutes).date() for item in sessions
    }
    today = _local_datetime(now_ms, offset_minutes).date()
    if today not in active_dates and today - timedelta(days=1) not in active_dates:
        return 0
    cursor = today if today in active_dates else today - timedelta(days=1)
    streak = 0
    while cursor in active_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _recommendation(
    session_count: int, total_minutes: int, best_hour: int | None, streak: int
) -> str:
    if session_count == 0:
        return "Заверши першу фокус-сесію — NOVA знайде твій робочий ритм."
    if streak >= 7:
        return f"Серія {streak} днів уже стала системою. Захисти цей самий час завтра."
    if best_hour is not None and total_minutes >= 120:
        return f"Найкраще вікно починається близько {best_hour:02d}:00. Заплануй там складну задачу."
    return "Додай ще одну коротку сесію сьогодні, щоб закріпити ритм без перевтоми."


def summarize(payload: AnalyticsRequest) -> AnalyticsSummary:
    now_ms = payload.now or int(datetime.now(tz=timezone.utc).timestamp() * 1000)
    period_start = now_ms - payload.period_days * MILLISECONDS_PER_DAY
    previous_start = period_start - payload.period_days * MILLISECONDS_PER_DAY
    current = [item for item in payload.sessions if period_start <= item.started_at <= now_ms]
    previous = [
        item for item in payload.sessions if previous_start <= item.started_at < period_start
    ]

    total_minutes = _minutes(current)
    previous_minutes = _minutes(previous)
    if previous_minutes:
        change_percent = round((total_minutes - previous_minutes) / previous_minutes * 100)
    else:
        change_percent = 100 if total_minutes else 0

    hours = Counter(
        _local_datetime(item.started_at, payload.timezone_offset_minutes).hour
        for item in current
    )
    best_hour = max(hours, key=lambda hour: (hours[hour], -hour)) if hours else None
    active_days = len(
        {
            _local_datetime(item.started_at, payload.timezone_offset_minutes).date()
            for item in current
        }
    )
    streak_days = _streak(payload.sessions, now_ms, payload.timezone_offset_minutes)

    project_minutes: defaultdict[str, int] = defaultdict(int)
    for item in current:
        project_minutes[item.project_id] += item.duration_seconds
    projects = {item.id: item for item in payload.projects}
    shares: list[ProjectShare] = []
    for project_id, seconds in sorted(
        project_minutes.items(), key=lambda pair: pair[1], reverse=True
    ):
        minutes = round(seconds / 60)
        project = projects.get(project_id)
        shares.append(
            ProjectShare(
                projectId=project_id,
                name=project.name if project else "Фокус",
                color=project.color if project else "#dfff00",
                minutes=minutes,
                percent=round(minutes / max(1, total_minutes) * 100, 1),
            )
        )

    consistency = min(40, active_days * 6)
    volume = min(35, round(total_minutes / max(1, payload.period_days * 25) * 35))
    session_quality = min(
        15,
        round(
            (_minutes(current) / max(1, len(current))) / 25 * 15
        ),
    )
    streak_score = min(10, streak_days * 2)
    focus_score = min(100, consistency + volume + session_quality + streak_score)

    return AnalyticsSummary(
        totalMinutes=total_minutes,
        averageMinutes=round(total_minutes / len(current)) if current else 0,
        longestMinutes=round(max((item.duration_seconds for item in current), default=0) / 60),
        sessionCount=len(current),
        bestHour=best_hour,
        activeDays=active_days,
        streakDays=streak_days,
        focusScore=focus_score,
        changePercent=change_percent,
        projectShares=shares,
        recommendation=_recommendation(len(current), total_minutes, best_hour, streak_days),
    )

