from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.users import User
from app.schemas.mock_interview import (
    EndInterviewOut,
    MockInterviewOut,
    RespondOut,
    StartInterviewIn,
    StartInterviewOut,
)
from app.services import mock_interview as interview_service
from app.services.auth import get_current_user
from app.services.vocal_analysis import process_uploaded_audio_for_transcript

router = APIRouter(prefix="/api/mock-interview", tags=["Mock Interview"])


def _get_owned_interview(db: Session, interview_id: int, user_id: int):
    interview = interview_service.get_interview(db, interview_id, user_id)
    if interview is None:
        raise HTTPException(status_code=404, detail="Mock interview not found")
    return interview


@router.post("/", response_model=StartInterviewOut, status_code=status.HTTP_201_CREATED)
def start_mock_interview(
    payload: StartInterviewIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Starts a new mock interview: asks Groq for an opening question for
    the given role, then persists the interview with that question as
    the first transcript turn. The Groq call happens before anything is
    written to the database, so a failed call never leaves behind a
    half-created interview.
    """
    first_question = interview_service.start_interview(payload.role)
    interview = interview_service.create_interview(db, current_user.id, payload.role, first_question)
    return StartInterviewOut(id=interview.id, role=interview.role, question=first_question)


@router.get("/", response_model=List[MockInterviewOut])
def list_mock_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every mock interview this user has done, most recent first."""
    interviews = interview_service.list_interviews(db, current_user.id)
    return [interview_service.to_out_dict(interview) for interview in interviews]


@router.get("/{interview_id}", response_model=MockInterviewOut)
def get_mock_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interview = _get_owned_interview(db, interview_id, current_user.id)
    return interview_service.to_out_dict(interview)


@router.post("/{interview_id}/respond", response_model=RespondOut)
async def respond_to_mock_interview(
    interview_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submits the candidate's spoken answer as an audio recording, gets it
    transcribed, and asks Groq for the interviewer's next question.

    Ordering matters here: the candidate's answer is transcribed and the
    Groq call for the next question is made using a LOCAL history list
    (not yet saved to the database). Only after Groq succeeds are both
    the candidate's answer and the interviewer's next question written to
    the transcript together, in one `append_turns` call. This keeps the
    stored transcript from ever ending up with a user turn but no
    matching assistant turn if the Groq call fails partway through.
    """
    interview = _get_owned_interview(db, interview_id, current_user.id)
    if interview.status != "in_progress":
        raise HTTPException(status_code=409, detail="This mock interview has already ended")

    transcript_result = await process_uploaded_audio_for_transcript(file)
    answer_text = transcript_result["transcript"]

    history = interview_service.get_history(interview)
    history_with_answer = history + [{"role": "user", "content": answer_text}]
    next_question = interview_service.continue_interview(interview.role, history_with_answer)

    updated_history = interview_service.append_turns(
        db,
        interview,
        [
            {"role": "user", "content": answer_text},
            {"role": "assistant", "content": next_question},
        ],
    )

    return RespondOut(
        id=interview.id,
        your_answer=answer_text,
        question=next_question,
        turn_count=len(updated_history),
    )


@router.post("/{interview_id}/end", response_model=EndInterviewOut)
def end_mock_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ends the interview: asks Groq for a short closing message based on
    the full conversation so far, then marks the interview completed.
    Like `respond`, the Groq call happens before the completion is
    committed, so a failed call leaves the interview still in_progress
    (safe to retry) rather than completed with no closing message.
    """
    interview = _get_owned_interview(db, interview_id, current_user.id)
    if interview.status != "in_progress":
        raise HTTPException(status_code=409, detail="This mock interview has already ended")

    history = interview_service.get_history(interview)
    closing_message = interview_service.close_interview(interview.role, history)
    interview_service.complete_interview(db, interview, closing_message)

    return EndInterviewOut(id=interview.id, closing_message=closing_message, transcript=history)
