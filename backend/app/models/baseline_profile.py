from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey, func
from app.database import Base

class BaselineProfile(Base):
    __tablename__ = "baseline_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    eye_contact_mean = Column(Float); eye_contact_std = Column(Float)
    blink_rate_mean = Column(Float); blink_rate_std = Column(Float)
    speaking_speed_mean = Column(Float); speaking_speed_std = Column(Float)
    pitch_stability_mean = Column(Float); pitch_stability_std = Column(Float)
    voice_energy_mean = Column(Float); voice_energy_std = Column(Float)
    pause_duration_mean = Column(Float); pause_duration_std = Column(Float)
    filler_word_rate_mean = Column(Float); filler_word_rate_std = Column(Float)
    facial_engagement_mean = Column(Float); facial_engagement_std = Column(Float)

    recovery_rate = Column(Float, nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="1")
    calibrated_at = Column(DateTime, nullable=False, server_default=func.now())