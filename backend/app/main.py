from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.health import router as health_router
from app.routes.auth import router as auth_router
from app.routes.sessions import router as sessions_router
from app.routes.baseline_profile import router as baseline_router
from app.routes.consent import router as consent_router
from app.routes.vocal_analysis import router as vocal_analysis_router

app = FastAPI(
    title="TruePrep API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(baseline_router)
app.include_router(consent_router)
app.include_router(vocal_analysis_router)


@app.get("/")
def root():
    return {
        "message": "Welcome to TruePrep API 🚀"
    }
