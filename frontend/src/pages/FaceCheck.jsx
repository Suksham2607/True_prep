import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import api from "../services/api";
import {
  createBlinkTracker,
  createGazeTracker,
  createEngagementTracker,
} from "../lib/faceMetrics";

// Milestone 4: run MediaPipe's Face Landmarker on the live webcam feed,
// entirely in the browser (the video frame is never sent anywhere), and
// turn the raw landmarks/blendshapes into three readable numbers: blink
// rate, an eye-contact estimate, and a facial engagement score. Nothing
// here is saved yet - Milestone 6 is where these numbers become part of a
// stored baseline. This page just proves the pipeline works and shows you
// the live output.

// Hosted by Google/jsDelivr - loaded once per visit, not bundled into the
// app, so the repo doesn't need to carry a multi-megabyte model file.
const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Pulled out to module scope (rather than called inline in the component)
// so these two "impure" calls - reading the clock, right before it's used -
// aren't textually inside the component function. They're only ever
// invoked from the animation-frame loop, never during an actual render,
// but React's purity lint rule can't see that distinction from inside.
function detectFrame(landmarker, video) {
  return landmarker.detectForVideo(video, performance.now());
}

function nowMs() {
  return performance.now();
}

function FaceCheck() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const trackersRef = useRef({
    blink: createBlinkTracker(),
    gaze: createGazeTracker(),
    engagement: createEngagementTracker(),
  });

  const [consentStatus, setConsentStatus] = useState("checking"); // checking | ok | missing | error
  const [modelStatus, setModelStatus] = useState("loading"); // loading | ready | error
  const [running, setRunning] = useState(false);
  const [faceVisible, setFaceVisible] = useState(false);
  const [liveStats, setLiveStats] = useState({ blinkRate: null, eyeContact: null, engagement: null });
  const [finalStats, setFinalStats] = useState(null);

  // Step 1: no point starting the camera/model if this user hasn't
  // consented yet - send them to the consent screen instead.
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

  // Step 2: once consent is confirmed, load the Face Landmarker model and
  // start the camera. Both happen in parallel since they're independent.
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera access failed:", err);
      }
    }

    setup();
    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [consentStatus]);

  function startTest() {
    trackersRef.current.blink.reset();
    trackersRef.current.gaze.reset();
    trackersRef.current.engagement.reset();
    setFinalStats(null);
    setRunning(true);
    detectLoop();
  }

  function stopTest() {
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const { blink, gaze, engagement } = trackersRef.current;
    setFinalStats({
      blinkCount: blink.getBlinkCount(),
      blinkRate: blink.getBlinkRatePerMinute(),
      eyeContact: gaze.getEyeContactPercent(),
      engagement: engagement.getAverageEngagement(),
    });
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

      setLiveStats({
        blinkRate: blink.getBlinkRatePerMinute(),
        eyeContact: gaze.getEyeContactPercent(),
        engagement: engagement.getAverageEngagement(),
      });
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

  function formatNumber(value, suffix = "") {
    if (value === null || value === undefined) return "--";
    return `${value.toFixed(1)}${suffix}`;
  }

  if (consentStatus === "checking") {
    return <CenteredMessage>Checking your consent status...</CenteredMessage>;
  }

  if (consentStatus === "error") {
    return (
      <CenteredMessage error>
        Couldn't check your consent status. Please try again.
      </CenteredMessage>
    );
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
          <h1 className="text-2xl font-bold text-soft-text">Face Check</h1>
          <button onClick={() => navigate("/dashboard")} className="text-sm text-soft-textMuted hover:text-soft-text">
            Back to dashboard
          </button>
        </div>

        <p className="text-soft-textMuted mb-4 leading-relaxed">
          This runs MediaPipe's face landmark model directly in your browser - your
          video never leaves this device. It's a live technical demo of the features
          that will feed into your Communication Readiness Score in a later
          milestone; nothing here is saved yet.
        </p>

        {/* Live video feed + landmark overlay - left plain/functional,
            only the corner radius was touched. */}
        <div className="relative bg-black rounded-soft overflow-hidden aspect-video mb-4">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {modelStatus === "loading" && (
            <Overlay>Loading AI model (only happens once per visit)...</Overlay>
          )}
          {modelStatus === "error" && (
            <Overlay error>Couldn't load the face detection model. Check your connection and reload.</Overlay>
          )}
          {modelStatus === "ready" && running && !faceVisible && (
            <Overlay>No face detected - make sure you're facing the camera.</Overlay>
          )}
        </div>

        <div className="flex gap-4 mb-6">
          {!running ? (
            <button
              onClick={startTest}
              disabled={modelStatus !== "ready"}
              className="bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition disabled:opacity-50"
            >
              Start Face Check
            </button>
          ) : (
            <button
              onClick={stopTest}
              className="bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
            >
              Stop
            </button>
          )}
        </div>

        {running && (
          <StatsGrid
            blinkRate={formatNumber(liveStats.blinkRate, "/min")}
            eyeContact={formatNumber(liveStats.eyeContact, "%")}
            engagement={formatNumber(liveStats.engagement)}
          />
        )}

        {finalStats && (
          <div className="bg-soft-surface rounded-soft-lg p-6 shadow-soft-flat">
            <h2 className="font-bold text-soft-text mb-4">Session summary</h2>
            <StatsGrid
              blinkRate={formatNumber(finalStats.blinkRate, "/min")}
              eyeContact={formatNumber(finalStats.eyeContact, "%")}
              engagement={formatNumber(finalStats.engagement)}
            />
            <p className="text-xs text-soft-textMuted mt-4">
              {finalStats.blinkCount} blink{finalStats.blinkCount === 1 ? "" : "s"} counted this
              session. These numbers reset each time you click Start - nothing is stored yet.
            </p>
            <Link
              to="/voice-check"
              className="inline-block mt-4 text-teal-700 font-semibold text-sm hover:underline"
            >
              Continue to Voice Check →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatsGrid({ blinkRate, eyeContact, engagement }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard label="BLINK RATE" value={blinkRate} />
      <StatCard label="EYE CONTACT" value={eyeContact} />
      <StatCard label="ENGAGEMENT" value={engagement} />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-soft-surface rounded-soft p-5 text-center shadow-soft-flat-sm">
      <div className="text-xs text-soft-textMuted font-semibold mb-2">{label}</div>
      <div className="text-2xl font-bold text-soft-text">{value}</div>
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
    <div className="min-h-screen bg-soft-bg flex items-center justify-center p-5">
      <div className={`max-w-md text-center ${error ? "text-red-600" : "text-soft-textMuted"}`}>{children}</div>
    </div>
  );
}

export default FaceCheck;
