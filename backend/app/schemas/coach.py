from datetime import datetime
from typing import Optional

from app.schemas.common import UTCTimestampModel


class CandidateSummary(UTCTimestampModel):
    """
    One row of a coach's candidate list - just enough to see who's
    practicing and how they're trending, built from the same `sessions`
    rows a candidate's own History page already reads. Nothing here that
    the candidate hasn't already made visible to themselves.
    """

    id: int
    name: str
    email: str
    session_count: int
    completed_count: int
    latest_score: Optional[float] = None
    last_active_at: Optional[datetime] = None
