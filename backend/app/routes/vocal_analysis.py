from fastapi import APIRouter, Depends, UploadFile

from app.models.users import User
from app.schemas.vocal_analysis import VocalAnalysisOut
from app.services.auth import get_current_user
from app.services.vocal_analysis import process_uploaded_audio

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
