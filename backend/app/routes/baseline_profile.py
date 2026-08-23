from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.users import User
from app.schemas.baseline_profile import BaselineProfileCreate, BaselineProfileOut
from app.services import baseline_profile as baseline_service
from app.services.auth import get_current_user

router = APIRouter(
    prefix="/api/baseline",
    tags=["Baseline Profile"]
)


@router.post("/", response_model=BaselineProfileOut, status_code=status.HTTP_201_CREATED)
def create_baseline(
    payload: BaselineProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Saves a new calibration baseline for the logged-in user and makes it
    the active one. Later (Milestone 6), these values will be filled in
    automatically from a real calibration recording — for now they're
    accepted directly so we can test the API end-to-end.
    """
    return baseline_service.create_baseline(db, current_user.id, payload.model_dump())


@router.get("/active", response_model=BaselineProfileOut)
def get_active_baseline(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The baseline that live sessions will be compared against."""
    baseline = baseline_service.get_active_baseline(db, current_user.id)
    if baseline is None:
        raise HTTPException(
            status_code=404,
            detail="No baseline profile found. Please calibrate first.",
        )
    return baseline


@router.get("/", response_model=List[BaselineProfileOut])
def list_baselines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every calibration this user has ever done, most recent first."""
    return baseline_service.list_baselines(db, current_user.id)
