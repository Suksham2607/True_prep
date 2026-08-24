from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Milestone 8: Groq's API key for the mock interview LLM. None if unset -
# app/services/mock_interview.py raises a clean, user-facing error at
# call time rather than crashing at import/startup.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
