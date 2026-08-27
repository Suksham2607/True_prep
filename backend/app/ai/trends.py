"""
Milestone 9: turning a user's session history into trends. Deliberately
does no new measurement or scoring of its own - every number here is
read straight out of what Milestone 7's readiness engine already
computed and stored per session (`overall_readiness_score`,
`feedback_json`). This module's only job is to look across many
sessions at once: is the score moving, and which features keep coming
up as mild/notable.

Comparing a session's `feedback_json` to today's baseline would be
wrong anyway - a baseline can change over time (a recalibration), so a
session's stored feedback reflects the baseline that was actually
active when it was measured. Trends are built from that historical
record, not recomputed against whatever baseline happens to be active
now.
"""
import json
from datetime import datetime, timedelta, timezone

from app.ai.readiness import FEATURE_META

# How many points a score needs before "improving"/"declining" means
# anything - one session isn't a trend, it's just a data point.
MIN_SESSIONS_FOR_TREND = 2
# A gap smaller than this between the latest score and the average of
# everything before it doesn't count as a real trend, just noise.
TREND_NOISE_FLOOR = 3.0

# Milestone 11: severity as a plain 0/1/2 rank, so "most improved" can
# compare an early stretch of sessions against a recent one without
# assuming which raw-value direction is "good" per feature (that's
# already handled at the point where a tip gets its wording - see
# app/ai/readiness.py's TIP_BANK). Getting closer to your own baseline,
# in either direction, counts as improvement here.
SEVERITY_RANK = {"in_range": 0, "mild": 1, "notable": 2}
# A feature needs at least this many scored sessions before splitting
# it into an "early half" vs "recent half" means anything.
MIN_POINTS_FOR_IMPROVEMENT = 4


def _completed_with_score(sessions):
    """Only sessions that actually finished with a score - an
    in_progress or abandoned session has nothing to trend."""
    return [s for s in sessions if s.status == "completed" and s.overall_readiness_score is not None]


def _parse_feedback(session_obj):
    if not session_obj.feedback_json:
        return []
    try:
        return json.loads(session_obj.feedback_json)
    except (TypeError, ValueError):
        # Shouldn't happen (we're the only writer of this column), but a
        # corrupt row here shouldn't take down the whole trends view.
        return []


def compute_score_trend(scores):
    """
    `scores`: the readiness scores in chronological order (oldest
    first). Compares the latest score against the average of every
    score before it - "improving"/"declining"/"steady" - or
    "insufficient_data" if there aren't enough sessions yet to say
    anything meaningful.
    """
    if len(scores) < MIN_SESSIONS_FOR_TREND:
        return "insufficient_data"

    latest = scores[-1]
    previous_average = sum(scores[:-1]) / len(scores[:-1])
    gap = latest - previous_average

    if gap > TREND_NOISE_FLOOR:
        return "improving"
    if gap < -TREND_NOISE_FLOOR:
        return "declining"
    return "steady"


def compute_streak(sessions, today=None):
    """
    Current consecutive-day streak of completed practice sessions, most
    recent day counted first. Two sessions on the same calendar day
    count as one streak day, not two. `today` is injectable for tests;
    defaults to the current UTC date.

    The streak is only "current" if the most recent practice day was
    today or yesterday - if it's older than that, practice has lapsed
    and the streak is 0, however long it used to be.
    """
    completed = _completed_with_score(sessions)
    if not completed:
        return 0

    if today is None:
        today = datetime.now(timezone.utc).date()

    practice_dates = sorted({s.started_at.date() for s in completed}, reverse=True)

    if practice_dates[0] < today - timedelta(days=1):
        return 0

    streak = 0
    expected_date = practice_dates[0]
    for d in practice_dates:
        if d == expected_date:
            streak += 1
            expected_date = expected_date - timedelta(days=1)
        elif d < expected_date:
            break

    return streak


def compute_most_improved_feature(feature_trends):
    """
    Which feature has moved closest to the user's own baseline lately -
    compares the average severity (in_range=0/mild=1/notable=2) of a
    feature's earlier scored sessions against its more recent ones.
    Needs at least MIN_POINTS_FOR_IMPROVEMENT scored sessions for a
    feature before an early/recent split means anything. Returns None
    if nothing qualifies - not enough data yet, or nothing's actually
    trending toward baseline.
    """
    best = None

    for trend in feature_trends:
        ranked = [SEVERITY_RANK[p["severity"]] for p in trend["points"] if p["severity"] in SEVERITY_RANK]
        if len(ranked) < MIN_POINTS_FOR_IMPROVEMENT:
            continue

        midpoint = len(ranked) // 2
        early_average = sum(ranked[:midpoint]) / midpoint
        recent_average = sum(ranked[midpoint:]) / (len(ranked) - midpoint)
        improvement = early_average - recent_average  # positive = moved toward baseline

        if improvement <= 0:
            continue
        if best is None or improvement > best["improvement"]:
            best = {"feature": trend["feature"], "label": trend["label"], "improvement": improvement}

    if best is None:
        return None

    return {
        "feature": best["feature"],
        "label": best["label"],
        "description": f"Your {best['label']} has been trending closer to your baseline lately.",
    }


def compute_trends(sessions):
    """
    `sessions`: every session belonging to one user, any order. Returns
    a dict matching the SessionTrends schema - see app/schemas/trends.py.
    """
    completed = _completed_with_score(sessions)
    # Chronological (oldest first) - a trend only makes sense read left
    # to right, and list_sessions() returns newest-first for the
    # dashboard's "recent activity" use case.
    completed_sorted = sorted(completed, key=lambda s: s.started_at)

    score_history = [
        {
            "session_id": s.id,
            "started_at": s.started_at,
            "overall_readiness_score": s.overall_readiness_score,
        }
        for s in completed_sorted
    ]
    scores = [point["overall_readiness_score"] for point in score_history]

    average_score = round(sum(scores) / len(scores), 1) if scores else None
    best_score = max(scores) if scores else None
    latest_score = scores[-1] if scores else None
    score_trend = compute_score_trend(scores)

    feature_trends = []
    for feature_key, meta in FEATURE_META.items():
        points = []
        for s in completed_sorted:
            entry = next(
                (f for f in _parse_feedback(s) if f.get("feature") == feature_key),
                None,
            )
            if entry is None:
                continue
            points.append({
                "session_id": s.id,
                "started_at": s.started_at,
                "value": entry.get("value"),
                "severity": entry.get("severity", "unknown"),
                "z_score": entry.get("z_score"),
                "tip": entry.get("tip"),
            })

        severity_counts = {"in_range": 0, "mild": 0, "notable": 0, "unknown": 0}
        for point in points:
            severity_counts[point["severity"]] = severity_counts.get(point["severity"], 0) + 1

        feature_trends.append({
            "feature": feature_key,
            "label": meta["label"],
            "points": points,
            "most_recent_severity": points[-1]["severity"] if points else "unknown",
            "most_recent_tip": points[-1]["tip"] if points else None,
            "in_range_count": severity_counts["in_range"],
            "mild_count": severity_counts["mild"],
            "notable_count": severity_counts["notable"],
        })

    return {
        "session_count": len(sessions),
        "completed_count": len(completed_sorted),
        "average_score": average_score,
        "best_score": best_score,
        "latest_score": latest_score,
        "score_trend": score_trend,
        "score_history": score_history,
        "feature_trends": feature_trends,
        "current_streak_days": compute_streak(sessions),
        "most_improved": compute_most_improved_feature(feature_trends),
    }
