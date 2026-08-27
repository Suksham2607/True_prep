from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


class ScorePoint(BaseModel):
    session_id: int
    started_at: datetime
    overall_readiness_score: float


class FeatureTrendPoint(BaseModel):
    session_id: int
    started_at: datetime
    value: Optional[float] = None
    severity: str  # "in_range" | "mild" | "notable" | "unknown"
    z_score: Optional[float] = None
    tip: Optional[str] = None


class FeatureTrend(BaseModel):
    feature: str
    label: str
    points: List[FeatureTrendPoint]
    most_recent_severity: str
    most_recent_tip: Optional[str] = None
    in_range_count: int
    mild_count: int
    notable_count: int


class MostImproved(BaseModel):
    """Milestone 11: the feature that's moved closest to the user's own
    baseline lately - see compute_most_improved_feature()."""

    feature: str
    label: str
    description: str


class SessionTrends(BaseModel):
    """What GET /api/sessions/trends returns - everything the History
    page needs to render the score-over-time chart, the per-feature
    breakdown, and the summary stat row, in one call."""

    session_count: int
    completed_count: int
    average_score: Optional[float] = None
    best_score: Optional[float] = None
    latest_score: Optional[float] = None
    score_trend: Literal["improving", "declining", "steady", "insufficient_data"]
    score_history: List[ScorePoint]
    feature_trends: List[FeatureTrend]
    current_streak_days: int = 0
    most_improved: Optional[MostImproved] = None
