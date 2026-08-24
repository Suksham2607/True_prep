from typing import List, Optional

from pydantic import BaseModel


class FeatureFeedback(BaseModel):
    """One feature's rule-based comparison against the baseline - see
    app/ai/readiness.py for how each field here is derived."""

    feature: str
    label: str
    value: Optional[float] = None
    baseline_mean: Optional[float] = None
    baseline_std: Optional[float] = None
    z_score: Optional[float] = None
    severity: str  # "in_range" | "mild" | "notable" | "unknown"
    message: str


class ReadinessResult(BaseModel):
    """What the frontend gets back after completing a live assessment."""

    session_id: int
    overall_readiness_score: Optional[float] = None
    feedback: List[FeatureFeedback]
    transcript: str
