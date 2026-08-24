from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, CheckConstraint, func
from app.database import Base


class MockInterview(Base):
    """
    Milestone 8: one LLM-driven mock interview session. `transcript_json`
    is a JSON-encoded list of {"role": "assistant"|"user", "content": ...}
    turns (mirrors the shape sent to Groq's chat API, minus the system
    prompt) - stored as text rather than a separate turns table since the
    whole conversation is always read/written together, never queried
    turn-by-turn.
    """
    __tablename__ = "mock_interviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(120), nullable=True)
    status = Column(String(20), nullable=False, server_default="in_progress")
    transcript_json = Column(Text, nullable=False, default="[]")
    closing_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=False, server_default=func.now())
    ended_at = Column(DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('in_progress', 'completed')",
            name="ck_mock_interviews_status",
        ),
    )
