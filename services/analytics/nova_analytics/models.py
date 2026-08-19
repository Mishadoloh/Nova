from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Session(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=120)
    project_id: str = Field(alias="projectId", min_length=1, max_length=120)
    started_at: int = Field(alias="startedAt", ge=0)
    duration_seconds: int = Field(alias="durationSeconds", ge=1, le=43_200)


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    color: str = Field(default="#dfff00", max_length=32)


class AnalyticsRequest(BaseModel):
    sessions: list[Session] = Field(default_factory=list, max_length=10_000)
    projects: list[Project] = Field(default_factory=list, max_length=1_000)
    timezone_offset_minutes: int = Field(
        default=0, alias="timezoneOffsetMinutes", ge=-840, le=840
    )
    period_days: int = Field(default=14, alias="periodDays", ge=1, le=366)
    now: int | None = Field(default=None, ge=0)


class ProjectShare(BaseModel):
    project_id: str = Field(alias="projectId")
    name: str
    color: str
    minutes: int
    percent: float


class AnalyticsSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_minutes: int = Field(alias="totalMinutes")
    average_minutes: int = Field(alias="averageMinutes")
    longest_minutes: int = Field(alias="longestMinutes")
    session_count: int = Field(alias="sessionCount")
    best_hour: int | None = Field(alias="bestHour")
    active_days: int = Field(alias="activeDays")
    streak_days: int = Field(alias="streakDays")
    focus_score: int = Field(alias="focusScore")
    change_percent: int = Field(alias="changePercent")
    project_shares: list[ProjectShare] = Field(alias="projectShares")
    recommendation: str

