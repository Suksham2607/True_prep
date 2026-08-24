import os
import uuid

from fastapi import HTTPException, UploadFile, status

from app.ai.vocal_features import analyze_recording

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")

# Loaded once and reused across requests - reloading the model on every
# API call would make every practice session take much longer than it
# needs to. `None` until the first request actually needs it.
_whisper_model = None


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        # "tiny" + int8: the lightest combination that still gives
        # reasonable transcription quality, chosen because this runs on
        # a Codespace CPU with no GPU. Downloads (~75MB) once on first
        # use, then reuses the cached copy.
        _whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
    return _whisper_model


async def process_uploaded_audio(upload_file: UploadFile) -> dict:
    """
    Saves the uploaded recording to a temp file just long enough to run
    analysis on it, then deletes it - raw audio isn't kept around after
    the features are extracted, matching the project's rule against
    storing raw media without a clear reason.
    """
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    temp_filename = f"{uuid.uuid4().hex}_{upload_file.filename or 'recording'}"
    temp_path = os.path.join(UPLOAD_DIR, temp_filename)

    try:
        contents = await upload_file.read()
        if not contents:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

        with open(temp_path, "wb") as f:
            f.write(contents)

        try:
            model = get_whisper_model()
        except Exception as e:
            # Most likely cause: no internet access to download the model
            # on first use. Surfaced as a clean 503 instead of a raw
            # traceback, since this is a real, expected failure mode.
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Speech analysis model isn't available right now ({e.__class__.__name__}). "
                "Check your internet connection and try again.",
            )

        try:
            return analyze_recording(temp_path, model)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Couldn't analyze that recording ({e.__class__.__name__}). "
                "Make sure it's a valid audio file with some speech in it.",
            )
    finally:
        # Always clean up the temp file, whether analysis succeeded,
        # failed, or something else went wrong above.
        if os.path.exists(temp_path):
            os.remove(temp_path)
