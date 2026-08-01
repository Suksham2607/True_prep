# True Prep — Build Roadmap

Adaptive Multimodal Communication Readiness Assessment Using Personalized Baseline
Calibration, Privacy-Preserving Edge AI, and LLM-Driven Context-Aware Mock Interviews.

Stack: React + Tailwind CSS · FastAPI + PostgreSQL · MediaPipe · Whisper · librosa ·
LLM API (OpenAI/Gemini/Claude) · Rule-Based Communication Readiness Engine.

No LSTM, Transformer training, XGBoost, or SHAP anywhere in this build — every milestone
uses practical, learnable tools suited to a first full-stack AI project.

---

## Milestone 1 — Environment Setup & Full-Stack Foundations (3–4 days)
**Objective:** Prove React, FastAPI, and PostgreSQL can talk to each other before any AI logic exists.
**Status:** IN PROGRESS — full detail given in chat. Complete the assignment before moving on.

- [ ] Backend starts cleanly (`uvicorn app.main:app --reload`)
- [ ] Frontend starts cleanly (`npm run dev`)
- [ ] Tailwind visibly styling the page
- [ ] Home page shows live "Backend: Connected" from `/api/health`
- [ ] `.env` used for secrets; `.env.example` committed instead
- [ ] Git initialized, `.gitignore` correct, first commit made

---

## Milestone 2 — Database Design & FastAPI Backend Core (5–6 days)
**Objective:** Design the real PostgreSQL schema and build proper CRUD structure (models,
schemas, routes, services) instead of the throwaway health check from M1.
**Covers:** users table, sessions table, baseline_profiles table, basic consent/auth flow.
*(Full detail delivered when we reach this milestone.)*

## Milestone 3 — React + Tailwind Frontend Foundations & Media Capture (5–6 days)
**Objective:** Build the real page shell (routing, layout, consent screen) and get
webcam/microphone capture working via `getUserMedia`.

## Milestone 4 — Facial & Eye Feature Extraction with MediaPipe (5–7 days)
**Objective:** Run MediaPipe's Face Landmarker client-side in React; compute blink rate,
gaze/eye-contact estimate, and facial engagement from landmarks.

## Milestone 5 — Vocal & Speech Feature Extraction with librosa + Whisper (6–8 days)
**Objective:** Stream audio to FastAPI; extract pitch stability, voice energy, pause
duration, speaking speed, and filler-word frequency via librosa + Whisper/faster-whisper.

## Milestone 6 — Personalized Baseline Calibration (4–5 days)
**Objective:** Build the 60-second calibration flow that combines M4 + M5 features into
each user's personal baseline (mean/std per feature), stored in PostgreSQL. This is the
project's core innovation — everything after this milestone measures *deviation* from it.

## Milestone 7 — Rule-Based Communication Readiness Engine + Explainable Feedback Report (5–6 days)
**Objective:** Combine the eight baseline-normalized features into a single 0–100
Communication Readiness Score with transparent weights, and generate the human-readable
Strengths / Needs Improvement report directly from those weights.

## Milestone 8 — LLM-Driven Adaptive Mock Interview Engine (6–7 days)
**Objective:** Integrate an LLM API to generate interview questions and adapt difficulty/
tone in real time based on the live Communication Readiness Score — the closed loop.

## Milestone 9 — Session Trend Analysis, Dashboard & Biofeedback Nudge (5–6 days)
**Objective:** Build the results dashboard (score timeline, feature breakdown, cross-session
trend), and the real-time breathing-cue nudge that triggers below a personalized threshold.

## Milestone 10 — Testing, User Acceptance Testing, Deployment & Polish (5–7 days)
**Objective:** Structured UAT with volunteers, System Usability Scale survey, latency/
reliability checks, deployment (or a clean local demo), and final documentation alignment
with your BRD/SRS.

---

*Estimated total: 8–10 weeks part-time. Each milestone will be taught in full detail
(Why / What / How / What to learn / Files & folders / DB tables / API endpoints /
frontend pages / assignment / review) when we reach it — not all at once.*
