from pydantic import BaseModel, EmailStr, ConfigDict, Field
from datetime import datetime

from app.schemas.common import UTCTimestampModel


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Profile page: only the display name is editable here. Email isn't -
    it's embedded in the JWT's `sub` claim (see create_access_token), so
    changing it would silently invalidate every token already issued for
    this account until the user logged back in."""
    name: str = Field(..., min_length=1, max_length=120)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class UserOut(UTCTimestampModel):
    id: int
    name: str
    email: EmailStr
    created_at: datetime
    has_given_consent: bool

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str
