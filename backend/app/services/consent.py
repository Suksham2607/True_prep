from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.users import User


def give_consent(db: Session, user: User) -> User:
    """
    Marks the logged-in user as having agreed to have their camera and
    microphone used during calibration and practice sessions, and
    records exactly when they agreed.
    """
    user.has_given_consent = True
    user.consent_given_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user
