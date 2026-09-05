from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.common import UTCTimestampModel


class BaselineProfileCreate(BaseModel):
    """
    All fields are optional floats because, for now, you may only have
    a subset of features to test with by hand. Once Milestones 4 and 5
    (MediaPipe + librosa/Whisper) exist, the calibration flow will fill
    in all of these automatically from a real 60-second recording.
    """
    eye_contact_mean: Optional[float] = None
    eye_contact_std: Optional[float] = None
    blink_rate_mean: Optional[float] = None
    blink_rate_std: Optional[float] = None
    speaking_speed_mean: Optional[float] = None
    speaking_speed_std: Optional[float] = None
    pitch_stability_mean: Optional[float] = None
    pitch_stability_std: Optional[float] = None
    voice_energy_mean: Optional[float] = None
    voice_energy_std: Optional[float] = None
    pause_duration_mean: Optional[float] = None
    pause_duration_std: Optional[float] = None
    filler_word_rate_mean: Optional[float] = None
    filler_word_rate_std: Optional[float] = None
    facial_engagement_mean: Optional[float] = None
    facial_engagement_std: Optional[float] = None
    recovery_rate: Optional[float] = None


class BaselineProfileOut(BaselineProfileCreate, UTCTimestampModel):
    """Adds the fields that are set by the server, not the client."""
    id: int
    user_id: int
    is_active: bool
    calibrated_at: datetime

    model_config = ConfigDict(from_attributes=True)
