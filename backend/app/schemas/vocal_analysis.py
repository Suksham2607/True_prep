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


class VocalCalibrationOut(BaseModel):
    """
    What the frontend gets back from the Milestone 6 calibration upload -
    mean + standard deviation across several windows of one longer
    recording, in the same field-naming shape the baseline profile
    (`BaselineProfileCreate`) expects, so the frontend can pass most of
    this straight through when it saves the baseline afterward.
    """

    window_count: int
    window_seconds: float
    total_duration_seconds: float
    transcript: str

    pitch_stability_mean: Optional[float] = None
    pitch_stability_std: Optional[float] = None
    voice_energy_mean: Optional[float] = None
    voice_energy_std: Optional[float] = None
    speaking_speed_mean: Optional[float] = None
    speaking_speed_std: Optional[float] = None
    pause_duration_mean: Optional[float] = None
    pause_duration_std: Optional[float] = None
    filler_word_rate_mean: Optional[float] = None
    filler_word_rate_std: Optional[float] = None
