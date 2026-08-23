from typing import Optional

from sqlalchemy.orm import Session

from app.models.baseline_profile import BaselineProfile


def create_baseline(db: Session, user_id: int, data: dict) -> BaselineProfile:
    """
    Deactivates any previous baseline this user had (only one should ever
    be 'active' — the most recent calibration), then saves the new one
    as the active baseline. `data` is the dict of feature values coming
    from the request body.
    """
    db.query(BaselineProfile).filter(
        BaselineProfile.user_id == user_id,
        BaselineProfile.is_active == True,  # noqa: E712
    ).update({"is_active": False})

    new_baseline = BaselineProfile(user_id=user_id, is_active=True, **data)
    db.add(new_baseline)
    db.commit()
    db.refresh(new_baseline)
    return new_baseline


def get_active_baseline(db: Session, user_id: int) -> Optional[BaselineProfile]:
    """The one baseline currently in use for comparisons."""
    return (
        db.query(BaselineProfile)
        .filter(
            BaselineProfile.user_id == user_id,
            BaselineProfile.is_active == True,  # noqa: E712
        )
        .first()
    )


def list_baselines(db: Session, user_id: int):
    """Full calibration history for this user, most recent first."""
    return (
        db.query(BaselineProfile)
        .filter(BaselineProfile.user_id == user_id)
        .order_by(BaselineProfile.calibrated_at.desc())
        .all()
    )
