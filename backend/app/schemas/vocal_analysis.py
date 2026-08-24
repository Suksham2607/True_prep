from typing import Optional

from pydantic import BaseModel


class VocalAnalysisOut(BaseModel):
    """What the frontend gets back after uploading a short recording."""

    duration_seconds: float
    transcript: str
    word_count: int

    pitch_stability: Optional[float] = None
    voice_energy: float

    pause_count: int
    total_pause_seconds: float
    longest_pause_seconds: float

    speaking_speed_wpm: Optional[float] = None

    filler_word_count: int
    filler_word_rate_per_minute: Optional[float] = None
    filler_word_percent: Optional[float] = None
