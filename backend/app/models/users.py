from sqlalchemy import Column, Integer, String, DateTime, Boolean, func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(190), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    has_given_consent = Column(Boolean, nullable=False, server_default="0")
    consent_given_at = Column(DateTime, nullable=True)
