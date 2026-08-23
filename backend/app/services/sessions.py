from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.sessions import PracticeSession


def create_session(db: Session, user_id: int) -> PracticeSession:
    """Starts a new practice session for this user. status defaults to
    'in_progress' and started_at defaults to now() at the database level
    (both set automatically by the model/migration)."""
    new_session = PracticeSession(user_id=user_id)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


def list_sessions(db: Session, user_id: int):
    """Every session belonging to this user, most recent first."""
    return (
        db.query(PracticeSession)
        .filter(PracticeSession.user_id == user_id)
        .order_by(PracticeSession.started_at.desc())
        .all()
    )


def get_session(db: Session, session_id: int, user_id: int) -> Optional[PracticeSession]:
    """
    Fetches one session, but ONLY if it belongs to this user. This is
    what stops user A from reading or editing user B's session by
    guessing an id in the URL.
    """
    return (
        db.query(PracticeSession)
        .filter(
            PracticeSession.id == session_id,
            PracticeSession.user_id == user_id,
        )
        .first()
    )


def update_session(
    db: Session,
    session_obj: PracticeSession,
    new_status: Optional[str],
    score: Optional[float],
) -> PracticeSession:
    if new_status is not None:
        session_obj.status = new_status
        if new_status in ("completed", "abandoned"):
            session_obj.ended_at = datetime.now(timezone.utc)

    if score is not None:
        session_obj.overall_readiness_score = score

    db.commit()
    db.refresh(session_obj)
    return session_obj
