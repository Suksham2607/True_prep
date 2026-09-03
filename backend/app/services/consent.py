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


def revoke_consent(db: Session, user: User) -> User:
    """
    Settings page: lets a user withdraw camera/microphone consent. Every
    route that gates a camera/mic feature already checks
    has_given_consent, so clearing it here is enough on its own to route
    the user back through the consent screen before their next session -
    no other cleanup needed. They can consent again anytime.
    """
    user.has_given_consent = False
    user.consent_given_at = None
    db.commit()
    db.refresh(user)
    return user
