import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { clearToken } from "../services/api";

// The sidebar's "Settings" link used to be a comingSoon() placeholder
// like "Predictions" still is - this is the real page. Scope is
// deliberately narrow: change password, and manage camera/mic consent.
// No account deletion here - that's a real, irreversible action that
// deserves its own dedicated flow, not a first pass.

function Settings() {
  const navigate = useNavigate();

  const [consentStatus, setConsentStatus] = useState("checking"); // checking | granted | not_granted | error
  const [revoking, setRevoking] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null); // { text, color }
  const [consentMessage, setConsentMessage] = useState(null);

  useEffect(() => {
    async function loadConsent() {
      try {
        const response = await api.get("/api/consent/");
        setConsentStatus(response.data.has_given_consent ? "granted" : "not_granted");
      } catch {
        setConsentStatus("error");
      }
    }
    loadConsent();
  }, []);

  async function handleChangePassword(event) {
    event.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ text: "New password must be at least 6 characters.", color: "#d64545" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "New passwords do not match.", color: "#d64545" });
      return;
    }

    setChangingPassword(true);
    try {
      await api.post("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordMessage({ text: "Password changed successfully.", color: "#0b7285" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setPasswordMessage({
        text: typeof detail === "string" ? detail : "Couldn't change your password. Please try again.",
        color: "#d64545",
      });
    } finally {
      setChangingPassword(false);
    }
  }

  async function revokeConsent() {
    if (!window.confirm("Withdraw camera/microphone consent? You'll need to grant it again before your next practice session.")) {
      return;
    }
    setRevoking(true);
    setConsentMessage(null);
    try {
      await api.post("/api/consent/revoke");
      setConsentStatus("not_granted");
      setConsentMessage({ text: "Consent withdrawn.", color: "#0b7285" });
    } catch {
      setConsentMessage({ text: "Couldn't withdraw consent right now. Please try again.", color: "#d64545" });
    } finally {
      setRevoking(false);
    }
  }

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-soft-bg p-5">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-soft-text">Settings</h1>
          <Link to="/dashboard" className="text-sm text-soft-textMuted hover:text-soft-text">
            Back to dashboard
          </Link>
        </div>

        {/* CHANGE PASSWORD */}
        <div className="bg-soft-surface rounded-soft-lg p-8 mb-6 shadow-soft-flat">
          <h2 className="font-bold text-soft-text mb-4">Change password</h2>
          <form onSubmit={handleChangePassword} className="grid gap-4">
            <div>
              <label className="block text-sm font-semibold text-soft-text mb-2">Current password</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full border-none rounded-soft-sm px-4 py-2 bg-soft-surface shadow-soft-inset-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-soft-text mb-2">New password</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                className="w-full border-none rounded-soft-sm px-4 py-2 bg-soft-surface shadow-soft-inset-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-soft-text mb-2">Confirm new password</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full border-none rounded-soft-sm px-4 py-2 bg-soft-surface shadow-soft-inset-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-soft-textMuted">
              <input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} />
              Show passwords
            </label>

            <button
              type="submit"
              disabled={changingPassword}
              className="bg-teal-700 text-white font-semibold px-6 py-3 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover active:shadow-soft-inset-sm transition disabled:opacity-60 justify-self-start"
            >
              {changingPassword ? "Changing..." : "Change Password"}
            </button>

            {passwordMessage && (
              <div className="text-sm" style={{ color: passwordMessage.color }}>
                {passwordMessage.text}
              </div>
            )}
          </form>
        </div>

        {/* PRIVACY */}
        <div className="bg-soft-surface rounded-soft-lg p-8 mb-6 shadow-soft-flat">
          <h2 className="font-bold text-soft-text mb-4">Privacy</h2>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm font-semibold text-soft-text mb-1">Camera/microphone consent</div>
              <div className="text-sm text-soft-textMuted">
                {consentStatus === "checking" && "Checking..."}
                {consentStatus === "granted" && "Currently granted - required for calibration, assessments, and mock interviews."}
                {consentStatus === "not_granted" && (
                  <>
                    Not currently granted.{" "}
                    <Link to="/consent" className="text-teal-700 underline">
                      Grant it
                    </Link>{" "}
                    to use camera/mic features again.
                  </>
                )}
                {consentStatus === "error" && "Couldn't check your consent status."}
              </div>
            </div>

            {consentStatus === "granted" && (
              <button
                onClick={revokeConsent}
                disabled={revoking}
                className="bg-soft-surface text-soft-text font-semibold px-4 py-2 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition disabled:opacity-60"
              >
                {revoking ? "Withdrawing..." : "Withdraw consent"}
              </button>
            )}
          </div>

          {consentMessage && (
            <div className="text-sm mt-4" style={{ color: consentMessage.color }}>
              {consentMessage.text}
            </div>
          )}
        </div>

        {/* ACCOUNT */}
        <div className="bg-soft-surface rounded-soft-lg p-8 shadow-soft-flat">
          <h2 className="font-bold text-soft-text mb-4">Account</h2>
          <button
            onClick={handleLogout}
            className="bg-soft-surface text-soft-text font-semibold px-4 py-2 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
