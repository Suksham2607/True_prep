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
