import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../services/api";

// RBAC milestone: the first real, visible use of the roles added to the
// backend. Only reachable by a coach/institute_admin account - a
// candidate hitting this URL directly still gets redirected away below,
// and the API itself would 403 them regardless (see require_role in
// app/services/auth.py), so this page never even gets a chance to make
// the request for the wrong role. Deliberately a plain list rather than
// a full dashboard - per-candidate trend charts and cohort analytics are
// future work; this proves the plumbing works end to end.

function scoreColor(score) {
  if (score === null || score === undefined) return "text-slate-400";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function formatDateTime(isoString) {
  if (!isoString) return "Never";
  return new Date(isoString).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function initialsFor(name) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "");
  return letters.join("") || "U";
}

function CoachTeam() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await api.get("/api/auth/me");

        if (!["coach", "institute_admin"].includes(meRes.data.role)) {
          setForbidden(true);
          return;
        }

        const candidatesRes = await api.get("/api/coach/candidates");
        setCandidates(candidatesRes.data);
      } catch {
        setError("Couldn't load your team. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (forbidden) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return <CenteredMessage>Loading your team...</CenteredMessage>;
  }

  if (error) {
    return <CenteredMessage error>{error}</CenteredMessage>;
  }

  return (
    <div className="min-h-screen bg-soft-bg p-5">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-soft-text">My Team</h1>
            <p className="text-sm text-soft-textMuted mt-1">
              Every candidate account and their Live Assessment activity.
            </p>
          </div>
          <Link to="/dashboard" className="text-sm text-soft-textMuted hover:text-soft-text">
            Back to dashboard
          </Link>
        </div>

        <div className="bg-soft-surface rounded-soft-lg p-6 shadow-soft-flat">
          {candidates.length === 0 ? (
            <p className="text-soft-textMuted text-sm">No candidate accounts yet.</p>
          ) : (
            <div className="divide-y divide-slate-200/60">
              {candidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {initialsFor(c.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-soft-text truncate">{c.name}</div>
                      <div className="text-xs text-soft-textMuted truncate">{c.email}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-soft-textMuted">Last active</div>
                    <div className="text-sm text-soft-text">{formatDateTime(c.last_active_at)}</div>
                  </div>

                  <div className="text-right w-24">
                    <div className="text-xs text-soft-textMuted">
                      {c.completed_count}/{c.session_count} completed
                    </div>
                    <div className={`text-lg font-bold ${scoreColor(c.latest_score)}`}>
                      {c.latest_score ?? "--"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CenteredMessage({ children, error }) {
  return (
    <div className="min-h-screen bg-soft-bg flex items-center justify-center p-5">
      <div className={`max-w-md text-center ${error ? "text-red-600" : "text-soft-textMuted"}`}>{children}</div>
    </div>
  );
}

export default CoachTeam;
