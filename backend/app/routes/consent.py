from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.users import User
from app.schemas.consent import ConsentOut
from app.services import consent as consent_service
from app.services.auth import get_current_user

router = APIRouter(
    prefix="/api/consent",
    tags=["Consent"]
)


@router.post("/", response_model=ConsentOut)
def give_consent(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Records that the logged-in user has agreed to camera/microphone
    recording. The frontend's consent screen (Milestone 3) calls this
    once, before letting a user start calibration or a session.
    """
    return consent_service.give_consent(db, current_user)


@router.get("/", response_model=ConsentOut)
def get_consent_status(
    current_user: User = Depends(get_current_user),
):
    """Lets the frontend check whether this user already consented,
    so it knows whether to show the consent screen again."""
    return current_user


@router.post("/revoke", response_model=ConsentOut)
def withdraw_consent(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Settings page: lets the user withdraw camera/microphone consent."""
    return consent_service.revoke_consent(db, current_user)
