from typing import List

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.users import User
from app.schemas.sessions import SessionOut, SessionUpdate
from app.schemas.readiness import ReadinessResult
from app.services import sessions as session_service
from app.services import readiness as readiness_service
from app.services.auth import get_current_user

router = APIRouter(
    prefix="/api/sessions",
    tags=["Sessions"]
)


@router.post("/", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def start_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Starts a new practice session for the logged-in user."""
    return session_service.create_session(db, current_user.id)


@router.get("/", response_model=List[SessionOut])
def list_my_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists every session that belongs to the logged-in user."""
    return session_service.list_sessions(db, current_user.id)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_obj = session_service.get_session(db, session_id, current_user.id)
    if session_obj is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_obj


@router.patch("/{session_id}", response_model=SessionOut)
def update_session(
    session_id: int,
    payload: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_obj = session_service.get_session(db, session_id, current_user.id)
    if session_obj is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return session_service.update_session(
        db, session_obj, payload.status, payload.overall_readiness_score
    )


@router.post("/{session_id}/complete", response_model=ReadinessResult)
async def complete_session(
    session_id: int,
    file: UploadFile,
    eye_contact: float = Form(...),
    blink_rate: float = Form(...),
    facial_engagement: float = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Milestone 7: finishes a live assessment. The face-side numbers are
    computed in the browser during the session and sent as form fields;
    the recorded audio comes along as the usual multipart file upload.
    Compares everything against the user's active baseline, saves the
    result onto this session, and returns the readiness score + the
    per-feature feedback that produced it.
    """
    session_obj = session_service.get_session(db, session_id, current_user.id)
    if session_obj is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_obj.status != "in_progress":
        raise HTTPException(
            status_code=409,
            detail="This session has already been completed or abandoned.",
        )

    return await readiness_service.complete_session_with_readiness(
        db, session_obj, current_user.id, file, eye_contact, blink_rate, facial_engagement
    )
