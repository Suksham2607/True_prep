import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import api from "../services/api";
import {
  createBlinkTracker,
  createGazeTracker,
  createEngagementTracker,
} from "../lib/faceMetrics";
import { meanAndStd } from "../lib/stats";

// Milestone 6: Personalized Baseline Calibration. Face Check (M4) and
// Voice Check (M5) each prove one pipeline works, but their numbers reset
// every time you leave the page - nothing is kept. Calibration is where
// that finally changes: it runs both pipelines together over one longer
// session, split into 6 ten-second segments, and saves the *mean and
// spread* across those segments as this account's baseline via the
// existing Milestone 2 `/api/baseline/` endpoints. Future sessions (a
// later milestone) get compared against this baseline instead of a
// generic one-size-fits-all number.

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const SEGMENT_SECONDS = 10;
const SEGMENT_COUNT = 6; // 60s total - comfortably above the backend's 3-window minimum

// Pulled to module scope for the same reason as in FaceCheck.jsx: keeps
// the "impure" clock read out of the component body so React's purity
// lint rule doesn't flag it, even though it's only ever called from the
// animation-frame loop.
function detectFrame(landmarker, video) {
  return landmarker.detectForVideo(video, performance.now());
}

function nowMs() {
  return performance.now();
}

function Calibration() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const tickRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const elapsedRef = useRef(0);
  const faceSamplesRef = useRef({ blinkRate: [], eyeContact: [], engagement: [] });
  const trackersRef = useRef({
    blink: createBlinkTracker(),
    gaze: createGazeTracker(),
    engagement: createEngagementTracker(),
  });

  const [consentStatus, setConsentStatus] = useState("checking"); // checking | ok | missing | error
  const [modelStatus, setModelStatus] = useState("loading"); // loading | ready | error
  const [phase, setPhase] = useState("idle"); // idle | running | processing | done | error
  const [faceVisible, setFaceVisible] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [baseline, setBaseline] = useState(null);

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
  }, []);

  useEffect(() => {
    if (consentStatus !== "ok") return;

    let cancelled = false;

    async function setup() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setModelStatus("ready");
      } catch (err) {
        console.error("Face Landmarker failed to load:", err);
        if (!cancelled) setModelStatus("error");
      }
    }

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera/microphone access failed:", err);
        if (!cancelled) {
          setErrorMessage("Couldn't access your camera and microphone. Check browser permissions and reload.");
          setPhase("error");
        }
      }
    }

    setup();
    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [consentStatus]);

  function startCalibration() {
    trackersRef.current.blink.reset();
    trackersRef.current.gaze.reset();
    trackersRef.current.engagement.reset();
    faceSamplesRef.current = { blinkRate: [], eyeContact: [], engagement: [] };
    audioChunksRef.current = [];
    elapsedRef.current = 0;
    setSecondsElapsed(0);
    setErrorMessage(null);
    setBaseline(null);

    const audioOnlyStream = new MediaStream(streamRef.current.getAudioTracks());
    const recorder = new MediaRecorder(audioOnlyStream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.onstop = handleRecordingStopped;
    mediaRecorderRef.current = recorder;
    recorder.start();

    setPhase("running");
    rafRef.current = requestAnimationFrame(detectLoop);
    tickRef.current = setInterval(tick, 1000);
  }

  function tick() {
    elapsedRef.current += 1;
    setSecondsElapsed(elapsedRef.current);

    if (elapsedRef.current % SEGMENT_SECONDS === 0) {
      const { blink, gaze, engagement } = trackersRef.current;
      faceSamplesRef.current.blinkRate.push(blink.getBlinkRatePerMinute());
      faceSamplesRef.current.eyeContact.push(gaze.getEyeContactPercent());
      faceSamplesRef.current.engagement.push(engagement.getAverageEngagement());
      blink.reset();
      gaze.reset();
      engagement.reset();
    }

    if (elapsedRef.current >= SEGMENT_SECONDS * SEGMENT_COUNT) {
      clearInterval(tickRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setPhase("processing");
    }
  }

  function detectLoop() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const canvas = canvasRef.current;
    if (!video || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const results = detectFrame(landmarker, video);
    const landmarks = results.faceLandmarks?.[0];
    const blendshapes = results.faceBlendshapes?.[0]?.categories;

    setFaceVisible(Boolean(landmarks));
    if (canvas) drawOverlay(canvas, video, landmarks);

    if (landmarks && blendshapes) {
      const { blink, gaze, engagement } = trackersRef.current;
      blink.update(blendshapes, nowMs());
      gaze.update(landmarks);
      engagement.update(blendshapes);
    }

    rafRef.current = requestAnimationFrame(detectLoop);
  }

  function drawOverlay(canvas, video, landmarks) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;

    ctx.fillStyle = "#2dd4bf";
    for (const point of landmarks) {
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 1.2, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  async function handleRecordingStopped() {
    const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(audioChunksRef.current, { type: mimeType });

    const eyeContact = meanAndStd(faceSamplesRef.current.eyeContact);
    const blinkRate = meanAndStd(faceSamplesRef.current.blinkRate);
    const engagement = meanAndStd(faceSamplesRef.current.engagement);

    const formData = new FormData();
    formData.append("file", blob, "calibration.webm");

    let voice;
    try {
      const response = await api.post("/api/vocal-analysis/calibration", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      voice = response.data;
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || "Couldn't analyze your calibration recording. Please try again.");
      setPhase("error");
      return;
    }

    const baselinePayload = {
      eye_contact_mean: eyeContact.mean,
      eye_contact_std: eyeContact.std,
      blink_rate_mean: blinkRate.mean,
      blink_rate_std: blinkRate.std,
      facial_engagement_mean: engagement.mean,
      facial_engagement_std: engagement.std,
      pitch_stability_mean: voice.pitch_stability_mean,
      pitch_stability_std: voice.pitch_stability_std,
      voice_energy_mean: voice.voice_energy_mean,
      voice_energy_std: voice.voice_energy_std,
      speaking_speed_mean: voice.speaking_speed_mean,
      speaking_speed_std: voice.speaking_speed_std,
      pause_duration_mean: voice.pause_duration_mean,
      pause_duration_std: voice.pause_duration_std,
      filler_word_rate_mean: voice.filler_word_rate_mean,
      filler_word_rate_std: voice.filler_word_rate_std,
    };

    try {
      const response = await api.post("/api/baseline/", baselinePayload);
      setBaseline(response.data);
      setPhase("done");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || "Your recording was analyzed, but saving the baseline failed. Please try again.");
      setPhase("error");
    }
  }

  function tryAgain() {
    setPhase("idle");
    setErrorMessage(null);
  }

  function formatPair(mean, std, suffix = "") {
    if (mean === null || mean === undefined) return "--";
    return `${mean.toFixed(1)}${suffix} ± ${(std ?? 0).toFixed(1)}${suffix}`;
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
        You need to grant camera/microphone consent before calibrating your baseline.
        <div className="mt-4">
          <Link to="/consent" className="text-teal-700 font-semibold underline">
            Go to consent screen
          </Link>
        </div>
      </CenteredMessage>
    );
  }

  const segmentNumber = Math.min(SEGMENT_COUNT, Math.floor(secondsElapsed / SEGMENT_SECONDS) + 1);
  const secondsIntoSegment = secondsElapsed % SEGMENT_SECONDS;
  const secondsLeftInSegment = secondsElapsed === 0 ? SEGMENT_SECONDS : SEGMENT_SECONDS - secondsIntoSegment;

  return (
    <div className="min-h-screen bg-slate-50 p-5">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Calibrate Your Baseline</h1>
          <button onClick={() => navigate("/dashboard")} className="text-sm text-slate-500 hover:text-slate-700">
            Back to dashboard
          </button>
        </div>

        <p className="text-slate-600 mb-4 leading-relaxed">
          This runs a single {SEGMENT_COUNT * SEGMENT_SECONDS}-second session combining Face
          Check and Voice Check, split into {SEGMENT_COUNT} ten-second segments. Talk naturally
          about anything - what matters is your normal range, not any particular answer. The
          average and spread across those segments become your personal baseline; later sessions
          (a future milestone) will be compared against this instead of a generic number.
        </p>

        {(phase === "idle" || phase === "running") && (
          <>
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

              {modelStatus === "loading" && (
                <Overlay>Loading AI model (only happens once per visit)...</Overlay>
              )}
              {modelStatus === "error" && (
                <Overlay error>Couldn't load the face detection model. Check your connection and reload.</Overlay>
              )}
              {modelStatus === "ready" && phase === "running" && !faceVisible && (
                <Overlay>No face detected - make sure you're facing the camera.</Overlay>
              )}
            </div>

            {phase === "idle" ? (
              <button
                onClick={startCalibration}
                disabled={modelStatus !== "ready"}
                className="bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-teal-800 transition disabled:opacity-50"
              >
                Start Calibration
              </button>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                <div className="text-sm text-slate-500 mb-1">
                  Segment {segmentNumber} of {SEGMENT_COUNT}
                </div>
                <div className="text-3xl font-bold text-teal-700">{secondsLeftInSegment}s</div>
                <div className="text-xs text-slate-400 mt-1">left in this segment - keep talking</div>
              </div>
            )}
          </>
        )}

        {phase === "processing" && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
            Analyzing your calibration recording (this can take a little while the first time,
            while the speech model downloads)...
          </div>
        )}

        {phase === "error" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-4">
              {errorMessage}
            </div>
            <button
              onClick={tryAgain}
              className="bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-teal-800 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {phase === "done" && baseline && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-bold text-slate-800 mb-1">Baseline saved</h2>
            <p className="text-xs text-slate-400 mb-4">
              Calibrated {new Date(baseline.calibrated_at).toLocaleString()} - each value is your
              average across the session, ± how much it naturally varied.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <StatCard label="EYE CONTACT" value={formatPair(baseline.eye_contact_mean, baseline.eye_contact_std, "%")} />
              <StatCard label="BLINK RATE" value={formatPair(baseline.blink_rate_mean, baseline.blink_rate_std, "/min")} />
              <StatCard label="ENGAGEMENT" value={formatPair(baseline.facial_engagement_mean, baseline.facial_engagement_std)} />
              <StatCard label="PITCH STABILITY" value={formatPair(baseline.pitch_stability_mean, baseline.pitch_stability_std)} />
              <StatCard label="VOICE ENERGY" value={formatPair(baseline.voice_energy_mean, baseline.voice_energy_std)} />
              <StatCard label="SPEAKING SPEED" value={formatPair(baseline.speaking_speed_mean, baseline.speaking_speed_std, " wpm")} />
              <StatCard label="PAUSE LENGTH" value={formatPair(baseline.pause_duration_mean, baseline.pause_duration_std, "s")} />
              <StatCard label="FILLER RATE" value={formatPair(baseline.filler_word_rate_mean, baseline.filler_word_rate_std, "/min")} />
            </div>
            <Link to="/dashboard" className="inline-block text-teal-700 font-semibold text-sm hover:underline">
              ← Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
      <div className="text-[11px] text-slate-400 font-semibold mb-1">{label}</div>
      <div className="text-base font-bold text-slate-800">{value}</div>
    </div>
  );
}

function Overlay({ children, error }) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center text-center px-6 text-sm ${
        error ? "text-red-300" : "text-white"
      } bg-black/60`}
    >
      {children}
    </div>
  );
}

function CenteredMessage({ children, error }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <div className={`max-w-md text-center ${error ? "text-red-600" : "text-slate-600"}`}>{children}</div>
    </div>
  );
}

export default Calibration;
