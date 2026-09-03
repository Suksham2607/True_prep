import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

// The sidebar's "Profile" link used to be a comingSoon() placeholder like
// "Predictions" still is - this is the real page. Deliberately small in
// scope: the only thing a user can actually change about their own
// identity here is their display name (see UserUpdate's docstring in
// app/schemas/users.py for why email isn't editable).

function initialsFor(name) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "");
  return letters.join("") || "U";
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { dateStyle: "long" });
}

function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { text, color }

  useEffect(() => {
    async function load() {
      try {
        const response = await api.get("/api/auth/me");
        setUser(response.data);
        setNameDraft(response.data.name);
      } catch {
        setError("Could not load your profile. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setMessage({ text: "Name can't be empty.", color: "#d64545" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await api.patch("/api/auth/me", { name: trimmed });
      setUser(response.data);
      setEditingName(false);
      setMessage({ text: "Name updated.", color: "#0b7285" });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setMessage({ text: detail || "Couldn't update your name. Please try again.", color: "#d64545" });
    } finally {
      setSaving(false);
    }
  }

  function cancelEditName() {
    setNameDraft(user.name);
    setEditingName(false);
    setMessage(null);
  }

  if (loading) {
    return <CenteredMessage>Loading your profile...</CenteredMessage>;
  }

  if (error) {
    return <CenteredMessage error>{error}</CenteredMessage>;
  }

  return (
    <div className="min-h-screen bg-soft-bg p-5">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-soft-text">My Profile</h1>
          <Link to="/dashboard" className="text-sm text-soft-textMuted hover:text-soft-text">
            Back to dashboard
          </Link>
        </div>

        <div className="bg-soft-surface rounded-soft-lg p-8 mb-6 shadow-soft-flat">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center text-xl font-bold shadow-soft-flat-sm">
              {initialsFor(user.name)}
            </div>
            <div>
              <div className="text-lg font-semibold text-soft-text">{user.name}</div>
              <div className="text-sm text-soft-textMuted">{user.email}</div>
            </div>
          </div>

          <div className="grid gap-6">
            <div>
              <label className="block text-sm font-semibold text-soft-text mb-2">Display name</label>
              {editingName ? (
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="flex-1 min-w-[200px] border-none rounded-soft-sm px-4 py-2 bg-soft-surface shadow-soft-inset-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <button
                    onClick={saveName}
                    disabled={saving}
                    className="bg-teal-700 text-white font-semibold px-4 py-2 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover active:shadow-soft-inset-sm transition disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={cancelEditName}
                    disabled={saving}
                    className="bg-soft-surface text-soft-text font-semibold px-4 py-2 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-soft-text">{user.name}</span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-sm text-teal-700 font-semibold hover:text-teal-800"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-soft-text mb-2">Email address</label>
              <div className="text-soft-text">{user.email}</div>
              <div className="text-xs text-soft-textMuted mt-1">Email can't be changed here.</div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-soft-text mb-2">Member since</label>
              <div className="text-soft-text">{formatDate(user.created_at)}</div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-soft-text mb-2">
                Camera/microphone consent
              </label>
              <span
                className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                  user.has_given_consent ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {user.has_given_consent ? "Granted" : "Not granted"}
              </span>
              <div className="text-xs text-soft-textMuted mt-1">
                Manage this from <Link to="/settings" className="text-teal-700 underline">Settings</Link>.
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div
            className="text-sm rounded-soft-sm p-4 mb-6 shadow-soft-inset-sm"
            style={{
              color: message.color,
              backgroundColor: message.color === "#d64545" ? "#fef2f2" : "#f0fdfa",
            }}
          >
            {message.text}
          </div>
        )}
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

export default Profile;
