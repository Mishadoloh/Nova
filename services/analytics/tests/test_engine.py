from nova_analytics.engine import summarize
from nova_analytics.models import AnalyticsRequest


def test_summary_uses_real_sessions() -> None:
    now = 1_750_000_000_000
    payload = AnalyticsRequest.model_validate(
        {
            "now": now,
            "periodDays": 14,
            "timezoneOffsetMinutes": -180,
            "projects": [{"id": "work", "name": "Робота", "color": "#ff765c"}],
            "sessions": [
                {
                    "id": "one",
                    "projectId": "work",
                    "startedAt": now - 3_600_000,
                    "durationSeconds": 1_500,
                },
                {
                    "id": "two",
                    "projectId": "work",
                    "startedAt": now - 86_400_000,
                    "durationSeconds": 2_700,
                },
            ],
        }
    )
    result = summarize(payload)
    assert result.total_minutes == 70
    assert result.average_minutes == 35
    assert result.longest_minutes == 45
    assert result.session_count == 2
    assert result.project_shares[0].percent == 100
    assert result.recommendation


def test_empty_summary_is_safe() -> None:
    result = summarize(AnalyticsRequest(sessions=[], projects=[], now=1_750_000_000_000))
    assert result.total_minutes == 0
    assert result.best_hour is None
    assert result.focus_score == 0

