import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import api from "../services/api";
import {
  createBlinkTracker,
  createGazeTracker,
  createEngagementTracker,
} from "../lib/faceMetrics";

// Milestone 7: the real, scored assessment - what "Start Assessment" on
// the Dashboard now actually runs. Face Check and Voice Check each prove
// one pipeline works, and Calibration turned those pipelines into a
// personal baseline. This page is where they finally connect: one
// combined 30-second session, compared against that baseline by the
// rule-based readiness engine, producing a score and plain-language,
// number-backed feedback - not a black-box judgment.

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const SESSION_SECONDS = 30;

// Same purity-lint workaround as FaceCheck.jsx/Calibration.jsx.
function detectFrame(landmarker, video) {
  return landmarker.detectForVideo(video, performance.now());
}

function nowMs() {
  return performance.now();
}

const SEVERITY_STYLES = {
  in_range: { dot: "bg-emerald-500", text: "text-slate-600" },
  mild: { dot: "bg-amber-500", text: "text-slate-700" },
  notable: { dot: "bg-red-500", text: "text-slate-800 font-medium" },
  unknown: { dot: "bg-slate-300", text: "text-slate-400 italic" },
};

function scoreColor(score) {
  if (score === null || score === undefined) return "text-slate-400";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function LiveAssessment() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const tickRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const sessionIdRef = useRef(null);
  const trackersRef = useRef({
    blink: createBlinkTracker(),
    gaze: createGazeTracker(),
    engagement: createEngagementTracker(),
  });

  const [consentStatus, setConsentStatus] = useState("checking"); // checking | ok | missing | error
  const [baselineStatus, setBaselineStatus] = useState("checking"); // checking | ok | missing | error
  const [modelStatus, setModelStatus] = useState("loading"); // loading | ready | error
  const [phase, setPhase] = useState("idle"); // idle | running | processing | done | error
  const [faceVisible, setFaceVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);
  const [errorMessage, setErrorMessage] = useState(null);
  const [result, setResult] = useState(null);

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

    async function checkBaseline() {
      try {
        await api.get("/api/baseline/active");
        setBaselineStatus("ok");
      } catch (err) {
        setBaselineStatus(err.response?.status === 404 ? "missing" : "error");
      }
    }
    checkBaseline();
  }, [consentStatus]);

  useEffect(() => {
    if (consentStatus !== "ok" || baselineStatus !== "ok") return;

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
  }, [consentStatus, baselineStatus]);

  async function startAssessment() {
    setErrorMessage(null);
    setResult(null);

    try {
      const response = await api.post("/api/sessions/");
      sessionIdRef.current = response.data.id;
    } catch {
      setErrorMessage("Couldn't start a new session. Please try again.");
      setPhase("error");
      return;
    }

    trackersRef.current.blink.reset();
    trackersRef.current.gaze.reset();
    trackersRef.current.engagement.reset();
    audioChunksRef.current = [];
    setSecondsLeft(SESSION_SECONDS);

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
    setSecondsLeft((s) => {
      if (s <= 1) {
        clearInterval(tickRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        mediaRecorderRef.current?.stop();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setPhase("processing");
        return 0;
      }
      return s - 1;
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
    const { blink, gaze, engagement } = trackersRef.current;
    const eyeContact = gaze.getEyeContactPercent();
    const blinkRate = blink.getBlinkRatePerMinute();
    const facialEngagement = engagement.getAverageEngagement();

    const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(audioChunksRef.current, { type: mimeType });

    const formData = new FormData();
    formData.append("file", blob, "assessment.webm");
    formData.append("eye_contact", eyeContact ?? 0);
    formData.append("blink_rate", blinkRate ?? 0);
    formData.append("facial_engagement", facialEngagement ?? 0);

    try {
      const response = await api.post(
        `/api/sessions/${sessionIdRef.current}/complete`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setResult(response.data);
      setPhase("done");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || "Couldn't score this session. Please try again.");
      setPhase("error");
    }
  }

  async function tryAgain() {
    // Don't leave the failed attempt's session sitting as "in_progress"
    // forever - mark it abandoned before starting a fresh one, using the
    // same PATCH endpoint Milestone 2 already provides.
    if (sessionIdRef.current) {
      try {
        await api.patch(`/api/sessions/${sessionIdRef.current}`, { status: "abandoned" });
      } catch {
        // Not worth blocking a retry over - the stale row is harmless.
      }
    }
    setPhase("idle");
    setErrorMessage(null);
  }

  if (consentStatus === "checking" || (consentStatus === "ok" && baselineStatus === "checking")) {
    return <CenteredMessage>Checking your setup...</CenteredMessage>;
  }

  if (consentStatus === "error" || baselineStatus === "error") {
    return <CenteredMessage error>Something went wrong checking your account. Please try again.</CenteredMessage>;
  }

  if (consentStatus === "missing") {
    return (
      <CenteredMessage>
        You need to grant camera/microphone consent before starting an assessment.
        <div className="mt-4">
          <Link to="/consent" className="text-teal-700 font-semibold underline">
            Go to consent screen
          </Link>
        </div>
      </CenteredMessage>
    );
  }

  if (baselineStatus === "missing") {
    return (
      <CenteredMessage>
        You need to calibrate your personal baseline before this can score anything -
        there's nothing yet to compare a session against.
        <div className="mt-4">
          <Link to="/calibration" className="text-teal-700 font-semibold underline">
            Calibrate your baseline
          </Link>
        </div>
      </CenteredMessage>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-5">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Live Assessment</h1>
          <button onClick={() => navigate("/dashboard")} className="text-sm text-slate-500 hover:text-slate-700">
            Back to dashboard
          </button>
        </div>

        <p className="text-slate-600 mb-4 leading-relaxed">
          A {SESSION_SECONDS}-second combined face + voice session, compared against your
          calibrated baseline. The readiness score reflects how close this session was to your
          own normal, not an absolute judgment - a rule-based comparison, not a trained model.
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
                onClick={startAssessment}
                disabled={modelStatus !== "ready"}
                className="bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-teal-800 transition disabled:opacity-50"
              >
                Start Assessment
              </button>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-teal-700">{secondsLeft}s</div>
                <div className="text-xs text-slate-400 mt-1">remaining - keep talking naturally</div>
              </div>
            )}
          </>
        )}

        {phase === "processing" && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
            Scoring your session (this can take a little while the first time, while the speech
            model downloads)...
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

        {phase === "done" && result && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="text-center mb-6">
              <div className="text-xs text-slate-400 font-semibold mb-1">READINESS SCORE</div>
              <div className={`text-5xl font-bold ${scoreColor(result.overall_readiness_score)}`}>
                {result.overall_readiness_score ?? "--"}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {result.feedback.map((f) => {
                const style = SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.unknown;
                return (
                  <div key={f.feature} className="flex items-start gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                    <div>
                      <div className={`text-sm ${style.text}`}>{f.message}</div>
                      {/* Milestone 11: a short, practice-oriented follow-up -
                          only present for mild/notable deviations, see
                          app/ai/readiness.py's TIP_BANK. */}
                      {f.tip && <div className="text-xs text-slate-500 mt-0.5">{f.tip}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {result.transcript && (
              <div className="text-sm text-slate-500 border-t border-slate-100 pt-4">
                <span className="font-semibold text-slate-700">Transcript: </span>
                {result.transcript}
              </div>
            )}

            <Link to="/dashboard" className="inline-block mt-4 text-teal-700 font-semibold text-sm hover:underline">
              ← Back to dashboard
            </Link>
          </div>
        )}
      </div>
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

export default LiveAssessment;
