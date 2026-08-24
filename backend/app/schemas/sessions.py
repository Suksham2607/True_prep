from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class SessionOut(BaseModel):
    """Shape of a session when we send it back to the frontend."""
    id: int
    user_id: int
    status: str
    overall_readiness_score: Optional[float] = None
    started_at: datetime
    ended_at: Optional[datetime] = None

    # Milestone 7: this session's own measured readings, once completed.
    # feedback_json isn't included here - the full structured feedback
    # comes back from POST /{id}/complete directly; a later milestone's
    # session-history view can add a dedicated endpoint to re-fetch it.
    eye_contact: Optional[float] = None
    blink_rate: Optional[float] = None
    facial_engagement: Optional[float] = None
    pitch_stability: Optional[float] = None
    voice_energy: Optional[float] = None
    speaking_speed: Optional[float] = None
    pause_duration: Optional[float] = None
    filler_word_rate: Optional[float] = None

    # Lets Pydantic read values straight off the SQLAlchemy model
    # (PracticeSession) instead of requiring a plain dict.
    model_config = ConfigDict(from_attributes=True)


class SessionUpdate(BaseModel):
    """
    Shape of the request body when updating a session (e.g. marking it
    completed and attaching a score). Both fields are optional so you can
    update just one at a time. `Literal` here means FastAPI will reject
    any status value that isn't one of these three with a clean 422 error,
    instead of letting a bad value hit the database's CHECK constraint.
    """
    status: Optional[Literal["in_progress", "completed", "abandoned"]] = None
    overall_readiness_score: Optional[float] = None
