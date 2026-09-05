from datetime import datetime
from typing import Optional

from pydantic import ConfigDict

from app.schemas.common import UTCTimestampModel


class ConsentOut(UTCTimestampModel):
    """What we send back after checking or giving consent."""
    has_given_consent: bool
    consent_given_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
