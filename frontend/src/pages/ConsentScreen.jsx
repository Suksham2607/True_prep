import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

// This page has two jobs, both required before any real practice session
// can start later (Milestones 4+):
//   1. Record the user's explicit consent to camera/mic use (backend
//      already has this: POST /api/consent/).
//   2. Prove getUserMedia actually works in this browser, by requesting
//      the camera/mic and showing a live preview.
// It does NOT record or analyze anything yet - that's later milestones.
// This screen only checks access and stores the yes/no decision.

function ConsentScreen() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [status, setStatus] = useState("loading"); // loading | already | needed | check-error
  const [consentInfo, setConsentInfo] = useState(null);

  const [mediaState, setMediaState] = useState("idle"); // idle | requesting | granted | denied
  const [mediaError, setMediaError] = useState(null);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Check whether this user has already consented, so we don't ask again
  // (and don't needlessly turn their camera on) every time they land here.
  useEffect(() => {
    async function loadConsentStatus() {
      try {
        const response = await api.get("/api/consent/");
        if (response.data.has_given_consent) {
          setConsentInfo(response.data);
          setStatus("already");
        } else {
          setStatus("needed");
        }
      } catch {
        setStatus("check-error");
      }
    }
    loadConsentStatus();
  }, []);

  // Always release the camera/mic when this page is left, however that
  // happens - clicking Continue, navigating away, or closing the tab.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function enableCamera() {
    setMediaState("requesting");
    setMediaError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMediaState("granted");
    } catch (err) {
      setMediaState("denied");
      setMediaError(
        err.name === "NotAllowedError"
          ? "Camera/microphone access was denied. You can allow it from your browser's site settings, then try again."
          : "Couldn't access a camera or microphone on this device. Check that one is connected and try again."
      );
    }
  }

  async function handleContinue() {
    setSubmitting(true);
    setSubmitError(null);

    // Stop the preview stream - we only needed it to prove access works,
    // not to keep the camera running while we call the backend.
    streamRef.current?.getTracks().forEach((track) => track.stop());

    try {
      await api.post("/api/consent/");
      navigate("/dashboard");
    } catch {
      setSubmitError("Couldn't save your consent. Please try again.");
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return <CenteredCard>Loading...</CenteredCard>;
  }

  if (status === "check-error") {
    return (
      <CenteredCard>
        <p className="text-red-600">Couldn't check your consent status. Please try again.</p>
        <Link to="/dashboard" className="text-teal-700 font-semibold underline mt-4 inline-block">
          Back to dashboard
        </Link>
      </CenteredCard>
    );
  }

  if (status === "already") {
    return (
      <CenteredCard>
        <h1 className="text-2xl font-bold text-soft-text mb-2">You're all set</h1>
        <p className="text-soft-textMuted mb-6">
          You already granted camera/microphone consent
          {consentInfo?.consent_given_at &&
            ` on ${new Date(consentInfo.consent_given_at).toLocaleDateString()}`}
          .
        </p>
        <Link
          to="/dashboard"
          className="inline-block bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
        >
          Back to dashboard
        </Link>
      </CenteredCard>
    );
  }

  // status === "needed"
  return (
    <CenteredCard wide>
      <h1 className="text-2xl font-bold text-soft-text mb-2">Camera &amp; microphone access</h1>
      <p className="text-soft-textMuted mb-6 leading-relaxed">
        Practice sessions in TruePrep look at both what you say and how you say it - things
        like pacing, tone, and eye contact - to build your personalized communication
        readiness profile. That requires access to your camera and microphone.
        <br />
        <br />
        This screen only checks that access works in your browser and records your decision.
        Nothing is recorded or analyzed yet - that arrives in a later milestone.
      </p>

      {/* Camera preview stays a plain black box - it's a real video feed,
          not a decorative surface, so it's left out of the soft-UI shadow
          treatment. */}
      <div className="bg-black rounded-soft overflow-hidden aspect-video mb-4 flex items-center justify-center">
        {mediaState === "granted" ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <span className="text-slate-400 text-sm">
            {mediaState === "requesting" ? "Requesting access..." : "No preview yet"}
          </span>
        )}
      </div>

      {mediaError && <p className="text-red-600 text-sm mb-4">{mediaError}</p>}

      {mediaState !== "granted" && (
        <button
          onClick={enableCamera}
          disabled={mediaState === "requesting"}
          className="w-full bg-slate-800 text-white font-semibold py-2.5 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition disabled:opacity-60 mb-4"
        >
          {mediaState === "requesting" ? "Requesting..." : "Enable Camera & Microphone"}
        </button>
      )}

      <label className="flex items-start gap-2 text-sm text-soft-textMuted mb-5">
        <input
          type="checkbox"
          checked={agreeChecked}
          onChange={(e) => setAgreeChecked(e.target.checked)}
          className="mt-0.5"
        />
        I understand and agree to let TruePrep use my camera and microphone during practice
        sessions.
      </label>

      {submitError && <p className="text-red-600 text-sm mb-4">{submitError}</p>}

      <div className="flex items-center gap-4">
        <button
          onClick={handleContinue}
          disabled={mediaState !== "granted" || !agreeChecked || submitting}
          className="flex-1 bg-teal-700 text-white font-semibold py-2.5 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover active:shadow-soft-inset-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : "Agree & Continue"}
        </button>

        <Link to="/dashboard" className="text-sm text-soft-textMuted hover:text-soft-text">
          Not now
        </Link>
      </div>
    </CenteredCard>
  );
}

function CenteredCard({ children, wide }) {
  return (
    <div className="min-h-screen bg-soft-bg flex items-center justify-center p-5">
      <div
        className={`w-full ${wide ? "max-w-xl text-left" : "max-w-md text-center"} bg-soft-surface rounded-soft-lg shadow-soft-flat p-8`}
      >
        {children}
      </div>
    </div>
  );
}

export default ConsentScreen;
