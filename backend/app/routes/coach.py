from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.users import User
from app.schemas.coach import CandidateSummary
from app.services.auth import require_role
from app.services.coach import list_candidates_with_stats

router = APIRouter(
    prefix="/api/coach",
    tags=["Coach"],
)


@router.get("/candidates", response_model=List[CandidateSummary])
def get_candidates(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("coach", "institute_admin")),
):
    """
    A coach's (or institute admin's) view of every candidate account and
    their Live Assessment activity. This is the first real thing gated by
    the roles added in this milestone - a candidate token gets a clean
    403 here. A full Coach Dashboard (per-candidate trend charts,
    cohort-level analytics per the SRS) is future work; this endpoint is
    the minimum slice needed to prove RBAC actually protects something.
    """
    return list_candidates_with_stats(db)
