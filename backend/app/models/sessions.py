from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, CheckConstraint, func
from app.database import Base

class PracticeSession(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False, server_default="in_progress")
    overall_readiness_score = Column(Float, nullable=True)
    started_at = Column(DateTime, nullable=False, server_default=func.now())
    ended_at = Column(DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('in_progress', 'completed', 'abandoned')",
            name="ck_sessions_status"
        ),
    )