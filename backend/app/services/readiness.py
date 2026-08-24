import json
from datetime import datetime, timezone

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.ai.readiness import evaluate_session
from app.models.sessions import PracticeSession
from app.services.baseline_profile import get_active_baseline
from app.services.vocal_analysis import process_uploaded_audio


async def complete_session_with_readiness(
    db: Session,
    session_obj: PracticeSession,
    user_id: int,
    file: UploadFile,
    eye_contact: float,
    blink_rate: float,
    facial_engagement: float,
) -> dict:
    """
    Milestone 7: the other half of a live assessment. The face-side
    numbers (eye_contact/blink_rate/facial_engagement) arrive already
    computed in the browser - same trackers as Face Check, just measured
    over one continuous session instead of Calibration's segments. The
    audio still needs server-side processing, so this reuses the same
    `process_uploaded_audio` pipeline as Voice Check rather than
    duplicating it.
    """
    baseline = get_active_baseline(db, user_id)
    if baseline is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No baseline profile found. Please calibrate your baseline first.",
        )

    voice = await process_uploaded_audio(file)

    # Same "mean pause length within this clip" definition Calibration's
    # backend windowing uses, so a session's pause_duration is directly
    # comparable to the baseline's pause_duration_mean/std.
    pause_duration = (
        voice["total_pause_seconds"] / voice["pause_count"]
        if voice["pause_count"] > 0
        else 0.0
    )

    session_values = {
        "eye_contact": eye_contact,
        "blink_rate": blink_rate,
        "facial_engagement": facial_engagement,
        "pitch_stability": voice["pitch_stability"],
        "voice_energy": voice["voice_energy"],
        "speaking_speed": voice["speaking_speed_wpm"],
        "pause_duration": pause_duration,
        "filler_word_rate": voice["filler_word_rate_per_minute"],
    }

    result = evaluate_session(session_values, baseline)

    session_obj.status = "completed"
    session_obj.ended_at = datetime.now(timezone.utc)
    session_obj.overall_readiness_score = result["overall_readiness_score"]
    session_obj.eye_contact = session_values["eye_contact"]
    session_obj.blink_rate = session_values["blink_rate"]
    session_obj.facial_engagement = session_values["facial_engagement"]
    session_obj.pitch_stability = session_values["pitch_stability"]
    session_obj.voice_energy = session_values["voice_energy"]
    session_obj.speaking_speed = session_values["speaking_speed"]
    session_obj.pause_duration = session_values["pause_duration"]
    session_obj.filler_word_rate = session_values["filler_word_rate"]
    session_obj.feedback_json = json.dumps(result["feedback"])

    db.commit()
    db.refresh(session_obj)

    return {
        "session_id": session_obj.id,
        "overall_readiness_score": result["overall_readiness_score"],
        "feedback": result["feedback"],
        "transcript": voice["transcript"],
    }
