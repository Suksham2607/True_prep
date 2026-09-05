from sqlalchemy.orm import Session

from app.models.sessions import PracticeSession
from app.models.users import User


def list_candidates_with_stats(db: Session):
    """
    Every candidate account, with just enough Live Assessment history for
    a coach to see who's practicing and how they're doing. Deliberately
    simple (one query per candidate rather than a hand-rolled join) to
    match how the rest of this codebase favors readable ORM queries over
    premature optimization - candidate lists are small enough that this
    isn't a real performance concern yet.
    """
    candidates = (
        db.query(User)
        .filter(User.role == "candidate")
        .order_by(User.name.asc())
        .all()
    )

    summaries = []
    for candidate in candidates:
        sessions = (
            db.query(PracticeSession)
            .filter(PracticeSession.user_id == candidate.id)
            .order_by(PracticeSession.started_at.desc())
            .all()
        )
        completed = [s for s in sessions if s.status == "completed"]

        summaries.append(
            {
                "id": candidate.id,
                "name": candidate.name,
                "email": candidate.email,
                "session_count": len(sessions),
                "completed_count": len(completed),
                "latest_score": completed[0].overall_readiness_score if completed else None,
                "last_active_at": sessions[0].started_at if sessions else None,
            }
        )

    return summaries
