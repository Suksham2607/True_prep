from sqlalchemy import Column, Integer, String, DateTime, Boolean, CheckConstraint, func
from app.database import Base

# The four roles the SRS defines. Every self-registered account starts
# as "candidate" - the other three are for people who work with other
# users' data (a coach reviewing a learner's sessions, an institute
# admin, a researcher) and aren't self-selectable at registration. Until
# a real admin UI exists, promoting an account to one of them is done
# out-of-band via scripts/set_role.py.
VALID_ROLES = ("candidate", "coach", "institute_admin", "researcher")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(190), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    has_given_consent = Column(Boolean, nullable=False, server_default="0")
    consent_given_at = Column(DateTime, nullable=True)
    role = Column(String(20), nullable=False, server_default="candidate")

    __table_args__ = (
        CheckConstraint(
            "role IN ('candidate', 'coach', 'institute_admin', 'researcher')",
            name="ck_users_role",
        ),
    )
