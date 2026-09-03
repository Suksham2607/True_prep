import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

// Milestone 5's frontend half: record a short clip with MediaRecorder,
// upload it to the backend (where librosa + Whisper do the real work -
// those aren't JavaScript tools, so unlike Face Check this can't run
// entirely in the browser), and show the returned features. The audio
// blob only exists in memory here and in a short-lived temp file on the
// backend - neither side keeps it after analysis finishes.

function VoiceCheck() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const [consentStatus, setConsentStatus] = useState("checking"); // checking | ok | missing | error
  const [recordingState, setRecordingState] = useState("idle"); // idle | recording | analyzing | done | error
  const [seconds, setSeconds] = useState(0);
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    async function checkConsent() {
      try {
        const response = await api.get("/api/consent/");
        setConsentStatus(response.data.has_given_consent ? "ok" : "missing");
      } catch {
        setConsentStatus("error");
      }
    }
    checkConsent();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    setErrorMessage(null);
    setResults(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = handleRecordingStopped;
      mediaRecorderRef.current = recorder;
      recorder.start();

      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setRecordingState("recording");
    } catch (err) {
      console.error("Microphone access failed:", err);
      setErrorMessage("Couldn't access your microphone. Check browser permissions and try again.");
      setRecordingState("error");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingState("analyzing");
  }

  async function handleRecordingStopped() {
    const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });

    const formData = new FormData();
    formData.append("file", blob, "recording.webm");

    try {
      const response = await api.post("/api/vocal-analysis/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults(response.data);
      setRecordingState("done");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || "Couldn't analyze that recording. Please try again.");
      setRecordingState("error");
    }
  }

  function reset() {
    setResults(null);
    setErrorMessage(null);
    setRecordingState("idle");
  }

  function formatNumber(value, suffix = "") {
    if (value === null || value === undefined) return "--";
    return `${value}${suffix}`;
  }

  if (consentStatus === "checking") {
    return <CenteredMessage>Checking your consent status...</CenteredMessage>;
  }

  if (consentStatus === "error") {
    return <CenteredMessage error>Couldn't check your consent status. Please try again.</CenteredMessage>;
  }

  if (consentStatus === "missing") {
    return (
      <CenteredMessage>
        You need to grant camera/microphone consent before using this feature.
        <div className="mt-4">
          <Link to="/consent" className="text-teal-700 font-semibold underline">
            Go to consent screen
          </Link>
        </div>
      </CenteredMessage>
    );
  }

  return (
    <div className="min-h-screen bg-soft-bg p-5">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-soft-text">Voice Check</h1>
          <Link to="/dashboard" className="text-sm text-soft-textMuted hover:text-soft-text">
            Back to dashboard
          </Link>
        </div>

        <p className="text-soft-textMuted mb-6 leading-relaxed">
          Record a short clip of yourself speaking - a sentence or two is enough. It's sent
          once to your own backend for analysis (pitch, pace, pauses, filler words), then
          deleted; nothing is stored. This is a live technical demo, same as Face Check -
          nothing here is saved to your account yet.
        </p>

        <div className="bg-soft-surface rounded-soft-lg p-8 text-center mb-6 shadow-soft-flat">
          {recordingState === "idle" && (
            <button
              onClick={startRecording}
              className="bg-teal-700 text-white font-semibold px-6 py-3 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
            >
              ● Start Recording
            </button>
          )}

          {recordingState === "recording" && (
            <div>
              <div className="text-3xl font-bold text-red-500 mb-4">● {seconds}s</div>
              <button
                onClick={stopRecording}
                className="bg-slate-800 text-white font-semibold px-6 py-3 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
              >
                Stop Recording
              </button>
            </div>
          )}

          {recordingState === "analyzing" && (
            <div className="text-soft-textMuted">Analyzing your recording (this can take a little while the first time, while the speech model downloads)...</div>
          )}

          {(recordingState === "done" || recordingState === "error") && (
            <button
              onClick={reset}
              className="bg-teal-700 text-white font-semibold px-6 py-3 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
            >
              Record Again
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-soft-sm p-4 mb-6">
            {errorMessage}
          </div>
        )}

        {results && (
          <div className="bg-soft-surface rounded-soft-lg p-6 shadow-soft-flat">
            <h2 className="font-bold text-soft-text mb-4">Results</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <StatCard label="PITCH STABILITY" value={formatNumber(results.pitch_stability)} />
              <StatCard label="VOICE ENERGY" value={formatNumber(results.voice_energy)} />
              <StatCard label="SPEAKING SPEED" value={formatNumber(results.speaking_speed_wpm, " wpm")} />
              <StatCard label="PAUSES" value={formatNumber(results.pause_count)} />
              <StatCard label="LONGEST PAUSE" value={formatNumber(results.longest_pause_seconds, "s")} />
              <StatCard label="FILLER WORDS" value={formatNumber(results.filler_word_count)} />
            </div>

            <div className="text-sm text-soft-textMuted">
              <span className="font-semibold text-soft-text">Transcript: </span>
              {results.transcript || <em>(no speech detected)</em>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-soft-surface rounded-soft p-4 text-center shadow-soft-inset-sm">
      <div className="text-[11px] text-soft-textMuted font-semibold mb-1">{label}</div>
      <div className="text-xl font-bold text-soft-text">{value}</div>
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

export default VoiceCheck;
