from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ConsentOut(BaseModel):
    """What we send back after checking or giving consent."""
    has_given_consent: bool
    consent_given_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
