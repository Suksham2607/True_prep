from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    """
    FastAPI dependency that opens one database session per request
    and always closes it afterwards, even if an error happens.
    Moved here from routes/auth.py so any route file can reuse it
    instead of each one defining its own copy.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
