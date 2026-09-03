import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

// Milestone 8: a live back-and-forth mock interview driven by Groq.
// Unlike Voice Check/Live Assessment this is audio-only and
// conversational - no camera, no scoring, just a chat-style transcript
// of interviewer questions and the candidate's spoken answers. Each
// answer is recorded, uploaded, transcribed on the backend, and the
// interviewer's next question comes back in the same response.

function MockInterview() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const transcriptEndRef = useRef(null);

  const [consentStatus, setConsentStatus] = useState("checking"); // checking | ok | missing | error
  const [role, setRole] = useState("");
  const [phase, setPhase] = useState("setup"); // setup | starting | chatting | recording | submitting | ending | ended | error
  const [interviewId, setInterviewId] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [closingMessage, setClosingMessage] = useState(null);
  const [seconds, setSeconds] = useState(0);
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

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  async function startInterview() {
    setErrorMessage(null);
    setPhase("starting");
    try {
      const response = await api.post("/api/mock-interview/", { role: role.trim() || null });
      setInterviewId(response.data.id);
      setTranscript([{ role: "assistant", content: response.data.question }]);
      setPhase("chatting");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || "Couldn't start the interview. Please try again.");
      setPhase("error");
    }
  }

  async function startRecording() {
    setErrorMessage(null);
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
      setPhase("recording");
    } catch (err) {
      console.error("Microphone access failed:", err);
      setErrorMessage("Couldn't access your microphone. Check browser permissions and try again.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("submitting");
  }

  async function handleRecordingStopped() {
    const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });

    const formData = new FormData();
    formData.append("file", blob, "answer.webm");

    try {
      const response = await api.post(`/api/mock-interview/${interviewId}/respond`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTranscript((prev) => [
        ...prev,
        { role: "user", content: response.data.your_answer },
        { role: "assistant", content: response.data.question },
      ]);
      setPhase("chatting");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || "Couldn't process that answer. Please try again.");
      setPhase("chatting");
    }
  }

  async function endInterview() {
    setErrorMessage(null);
    setPhase("ending");
    try {
      const response = await api.post(`/api/mock-interview/${interviewId}/end`);
      setClosingMessage(response.data.closing_message);
      setPhase("ended");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || "Couldn't end the interview. Please try again.");
      setPhase("chatting");
    }
  }

  function startOver() {
    setInterviewId(null);
    setTranscript([]);
    setClosingMessage(null);
    setErrorMessage(null);
    setRole("");
    setPhase("setup");
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
          <h1 className="text-2xl font-bold text-soft-text">Mock Interview</h1>
          <Link to="/dashboard" className="text-sm text-soft-textMuted hover:text-soft-text">
            Back to dashboard
          </Link>
        </div>

        <p className="text-soft-textMuted mb-6 leading-relaxed">
          Practice a real back-and-forth interview with an AI interviewer. Answer out loud like
          you would in the real thing - each answer is transcribed and the interviewer follows up
          based on what you said.
        </p>

        {phase === "setup" && (
          <div className="bg-soft-surface rounded-soft-lg p-8 shadow-soft-flat">
            <label className="block text-sm font-semibold text-soft-text mb-2">
              What role are you practicing for? (optional)
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Backend Developer, Product Manager..."
              className="w-full border-none rounded-soft-sm px-4 py-2 mb-6 bg-soft-surface shadow-soft-inset-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button
              onClick={startInterview}
              className="bg-teal-700 text-white font-semibold px-6 py-3 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
            >
              Start Interview
            </button>
          </div>
        )}

        {phase === "starting" && (
          <div className="bg-soft-surface rounded-soft-lg p-8 text-center text-soft-textMuted shadow-soft-flat">
            Starting your interview...
          </div>
        )}

        {["chatting", "recording", "submitting", "ending", "ended"].includes(phase) && (
          <>
            <div className="bg-soft-surface rounded-soft-lg p-6 mb-6 max-h-[28rem] overflow-y-auto shadow-soft-inset">
              {transcript.map((turn, i) => (
                <TranscriptBubble key={i} turn={turn} />
              ))}
              {phase === "submitting" && (
                <TranscriptBubble turn={{ role: "assistant", content: "..." }} pending />
              )}
              <div ref={transcriptEndRef} />
            </div>

            {phase !== "ended" && (
              <div className="bg-soft-surface rounded-soft-lg p-6 text-center mb-6 shadow-soft-flat">
                {phase === "chatting" && (
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button
                      onClick={startRecording}
                      className="bg-teal-700 text-white font-semibold px-6 py-3 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
                    >
                      ● Record Answer
                    </button>
                    <button
                      onClick={endInterview}
                      className="bg-soft-surface text-soft-text font-semibold px-6 py-3 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
                    >
                      End Interview
                    </button>
                  </div>
                )}

                {phase === "recording" && (
                  <div>
                    <div className="text-3xl font-bold text-red-500 mb-4">● {seconds}s</div>
                    <button
                      onClick={stopRecording}
                      className="bg-slate-800 text-white font-semibold px-6 py-3 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
                    >
                      Stop &amp; Submit Answer
                    </button>
                  </div>
                )}

                {phase === "submitting" && (
                  <div className="text-soft-textMuted">Transcribing your answer and getting the next question...</div>
                )}

                {phase === "ending" && <div className="text-soft-textMuted">Wrapping up the interview...</div>}
              </div>
            )}

            {phase === "ended" && (
              <div className="bg-soft-surface rounded-soft-lg p-6 mb-6 shadow-soft-flat">
                <h2 className="font-bold text-soft-text mb-2">Interview Complete</h2>
                <p className="text-soft-text leading-relaxed mb-6">{closingMessage}</p>
                <button
                  onClick={startOver}
                  className="bg-teal-700 text-white font-semibold px-6 py-3 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
                >
                  Start Another Interview
                </button>
              </div>
            )}
          </>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-soft-sm p-4 mb-6">
            {errorMessage}
          </div>
        )}

        {phase === "error" && (
          <button
            onClick={startOver}
            className="bg-teal-700 text-white font-semibold px-6 py-3 rounded-soft-sm shadow-soft-flat-sm hover:shadow-soft-flat-hover transition"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

function TranscriptBubble({ turn, pending }) {
  const isAssistant = turn.role === "assistant";
  return (
    <div className={`flex mb-4 ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-soft-sm px-4 py-3 text-sm leading-relaxed ${
          isAssistant ? "bg-soft-bg text-soft-text shadow-soft-inset-sm" : "bg-teal-700 text-white shadow-soft-flat-sm"
        } ${pending ? "opacity-60 italic" : ""}`}
      >
        <div className="text-[11px] font-semibold mb-1 opacity-70">
          {isAssistant ? "Interviewer" : "You"}
        </div>
        {turn.content}
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

export default MockInterview;
