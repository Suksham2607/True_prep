# TruePrep

TruePrep is an AI-powered interview-prep and communication-coaching platform. It helps you
practice speaking with confidence, ease interview anxiety, and get ready for real HR and
technical interviews - combining webcam/mic-based feedback against your own personal
baseline with an LLM-driven mock interviewer.

This README covers local setup only. Deployment isn't documented yet - that's a separate,
later step.

## What's in here

- **Personal baseline calibration** - a short guided recording establishes your own normal
  eye contact, blink rate, facial engagement, and vocal patterns, so every later session is
  measured against *you*, not a generic average.
- **Live Assessment** - a real-time practice session scored against your baseline, with
  plain-language feedback and short coaching tips on whatever needs the most attention.
- **Mock Interview** - a live, back-and-forth interview with an AI interviewer (via Groq).
  Answer out loud; each answer is transcribed and the interviewer follows up naturally.
- **History & Trends** - your readiness score over time, a per-feature breakdown, a practice
  streak, and a callout for whichever feature has improved the most lately.

## Tech stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** FastAPI + SQLAlchemy + Alembic
- **Database:** MySQL
- **On-device AI:** MediaPipe Face Landmarker (eye contact, blink rate, facial engagement)
- **Server-side AI:** faster-whisper (speech-to-text), librosa (vocal features), Groq (mock
  interview LLM)

## Prerequisites

- Node.js 18+
- Python 3.11 (the native dependencies below are version-sensitive - other versions may not
  install cleanly)
- A running MySQL server
- A free [Groq](https://console.groq.com) API key (only needed for Mock Interview - every
  other feature works without one)

## Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env with your real values - see "Environment variables" below

alembic upgrade head             # creates/updates all database tables
uvicorn app.main:app --reload    # starts the API on http://localhost:8000
```

Visit `http://localhost:8000/docs` for the interactive API docs, and `http://localhost:8000/api/health`
to confirm the database connection is working.

## Frontend setup

```bash
cd frontend
npm install
npm run dev                      # starts the app on http://localhost:5173
```

By default the frontend talks to `http://localhost:8000`. To point it somewhere else, set
`VITE_API_URL` (e.g. in a `frontend/.env` file):

```
VITE_API_URL=http://localhost:8000
```

## Environment variables (backend/.env)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLAlchemy connection string for your MySQL database, e.g. `mysql+pymysql://user:password@localhost/trueprep` |
| `SECRET_KEY` | Yes | Signs login JWTs. Use a long random string - never reuse a sample/tutorial value. |
| `ALGORITHM` | No (defaults to `HS256`) | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No (defaults to `30`) | How long a login session lasts before re-authentication is required |
| `GROQ_API_KEY` | Only for Mock Interview | Free key from console.groq.com. Every other feature works without it. |

Never commit a real `.env` file - `backend/.env.example` is the template that's tracked in
git instead.

## Running the test suites

There isn't a single `pytest` entry point yet - each backend feature has its own
throwaway-database test script (see the project's development history for details on how
these are run). Frontend checks are the usual Vite/ESLint commands:

```bash
cd frontend
npm run lint
npm run build
```

## Project status

Built incrementally as a series of milestones - personal baseline calibration, live
assessment scoring, mock interviews, history/trends, and anxiety-coaching feedback are all
in place. HR-focused interview mode with job-description tailoring, a common question bank,
group discussion practice, and usage limits are still in progress.
