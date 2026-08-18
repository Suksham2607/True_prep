from fastapi import APIRouter
from sqlalchemy import text
from app.database import engine

router = APIRouter(
    prefix="/api",
    tags=["Health"]
)


@router.get("/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "connected"}
    except Exception as e:
        return {"status": "disconnected", "detail": str(e)}