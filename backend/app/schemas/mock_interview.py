from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.common import UTCTimestampModel


class InterviewTurn(BaseModel):
    role: str  # "assistant" | "user"
    content: str


class StartInterviewIn(BaseModel):
    """`role` is freeform text (e.g. "Backend Developer") - falls back to
    a generic professional interview if left blank."""
    role: Optional[str] = None


class StartInterviewOut(BaseModel):
    id: int
    role: Optional[str] = None
    question: str


class RespondOut(BaseModel):
    id: int
    your_answer: str
    question: str
    turn_count: int


class EndInterviewOut(BaseModel):
    id: int
    closing_message: str
    transcript: List[InterviewTurn]


class MockInterviewOut(UTCTimestampModel):
    """Full interview state - not built with from_attributes, since
    transcript_json needs to be parsed from a JSON string first (see
    app/services/mock_interview.py's get_interview_out)."""
    id: int
    user_id: int
    role: Optional[str] = None
    status: str
    transcript: List[InterviewTurn]
    closing_message: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
