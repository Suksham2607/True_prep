from fastapi import APIRouter, Depends, UploadFile

from app.models.users import User
from app.schemas.vocal_analysis import VocalAnalysisOut, VocalCalibrationOut
from app.services.auth import get_current_user
from app.services.vocal_analysis import (
    process_uploaded_audio,
    process_uploaded_audio_for_calibration,
)

router = APIRouter(prefix="/api/vocal-analysis", tags=["Vocal Analysis"])


@router.post("/", response_model=VocalAnalysisOut)
async def analyze_vocal_recording(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    """
    Accepts a short recording (from the frontend's Voice Check page),
    transcribes it and extracts pitch/energy/pause/speaking-speed/filler-
    word features, then discards the audio file. Like Face Check, nothing
    is stored yet - this proves the pipeline and shows you the numbers.
    """
    return await process_uploaded_audio(file)


@router.post("/calibration", response_model=VocalCalibrationOut)
async def analyze_vocal_calibration(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    """
    Milestone 6: accepts one longer recording (the Calibration page asks
    for ~60s), slices it into windows and returns the mean/std across
    them for each vocal feature - the shape needed to save a baseline
    profile via `/api/baseline/`.
    """
    return await process_uploaded_audio_for_calibration(file)
