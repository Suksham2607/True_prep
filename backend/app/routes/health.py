from fastapi import APIRouter, Response, status
from sqlalchemy import text
from app.database import engine

router = APIRouter(
    prefix="/api",
    tags=["Health"]
)


@router.get("/health")
def health_check(response: Response):
    """
    A host's health check (Render/Railway/etc. restarting or alerting on a
    dead instance) almost always looks at the HTTP status code alone, not
    the response body - so a disconnected database has to come back as a
    real error status, not a 200 with "disconnected" buried in the JSON.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "connected"}
    except Exception as e:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "disconnected", "detail": str(e)}