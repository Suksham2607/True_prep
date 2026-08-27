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

from app.ai.readiness import FEATURE_META

# How many points a score needs before "improving"/"declining" means
# anything - one session isn't a trend, it's just a data point.
MIN_SESSIONS_FOR_TREND = 2
# A gap smaller than this between the latest score and the average of
# everything before it doesn't count as a real trend, just noise.
TREND_NOISE_FLOOR = 3.0


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
            })

        severity_counts = {"in_range": 0, "mild": 0, "notable": 0, "unknown": 0}
        for point in points:
            severity_counts[point["severity"]] = severity_counts.get(point["severity"], 0) + 1

        feature_trends.append({
            "feature": feature_key,
            "label": meta["label"],
            "points": points,
            "most_recent_severity": points[-1]["severity"] if points else "unknown",
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
    }
