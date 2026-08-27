import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

// Milestone 9: turns the readiness scores Milestone 7 has been quietly
// saving on every completed session into something you can actually
// look back on - is the overall score moving, and which features keep
// coming up as mild/notable. All the numbers here come from
// GET /api/sessions/trends, which reads straight from what each session
// already stored at the time it was measured (see app/ai/trends.py) -
// this page does no scoring of its own, just charts what's already there.

const SEVERITY_STYLES = {
  in_range: { dot: "bg-emerald-500", text: "text-emerald-700", label: "In range" },
  mild: { dot: "bg-amber-500", text: "text-amber-700", label: "Mild" },
  notable: { dot: "bg-red-500", text: "text-red-700", label: "Notable" },
  unknown: { dot: "bg-slate-300", text: "text-slate-400", label: "No data" },
};

function scoreColor(score) {
  if (score === null || score === undefined) return "text-slate-400";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const TREND_DISPLAY = {
  improving: { arrow: "▲", text: "text-emerald-600", label: "Improving" },
  declining: { arrow: "▼", text: "text-red-600", label: "Declining" },
  steady: { arrow: "→", text: "text-slate-500", label: "Steady" },
  insufficient_data: { arrow: "", text: "text-slate-400", label: "Not enough data yet" },
};

function History() {
  const [trends, setTrends] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [trendsRes, sessionsRes] = await Promise.all([
          api.get("/api/sessions/trends"),
          api.get("/api/sessions/"),
        ]);
        setTrends(trendsRes.data);
        setSessions(sessionsRes.data);
      } catch {
        setError("Couldn't load your history. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <CenteredMessage>Loading your history...</CenteredMessage>;
  }

  if (error) {
    return <CenteredMessage error>{error}</CenteredMessage>;
  }

  const trendInfo = TREND_DISPLAY[trends.score_trend] || TREND_DISPLAY.insufficient_data;

  return (
    <div className="min-h-screen bg-slate-50 p-5">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-800">History &amp; Trends</h1>
          <Link to="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            Back to dashboard
          </Link>
        </div>

        {/* SUMMARY ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="COMPLETED SESSIONS" value={trends.completed_count} />
          <StatCard
            label="AVERAGE SCORE"
            value={trends.average_score ?? "--"}
            valueClass={scoreColor(trends.average_score)}
          />
          <StatCard label="BEST SCORE" value={trends.best_score ?? "--"} valueClass={scoreColor(trends.best_score)} />
          <StatCard
            label="TREND"
            value={
              <span className={trendInfo.text}>
                {trendInfo.arrow} {trendInfo.label}
              </span>
            }
            small
          />
        </div>

        {/* SCORE OVER TIME */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h2 className="font-bold text-slate-800 mb-4">Readiness Score Over Time</h2>
          <ScoreChart points={trends.score_history} />
        </div>

        {/* PER-FEATURE BREAKDOWN */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h2 className="font-bold text-slate-800 mb-4">Feature Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {trends.feature_trends.map((feature) => (
              <FeatureTrendCard key={feature.feature} feature={feature} />
            ))}
          </div>
        </div>

        {/* SESSION LIST */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-bold text-slate-800 mb-4">All Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-slate-500 text-sm">
              No sessions yet.{" "}
              <Link to="/dashboard" className="text-teal-700 underline">
                Start your first assessment
              </Link>
              .
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">Session #{s.id}</div>
                    <div className="text-xs text-slate-400">{formatDateTime(s.started_at)}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={s.status} />
                    <div className={`text-lg font-bold w-14 text-right ${scoreColor(s.overall_readiness_score)}`}>
                      {s.overall_readiness_score ?? "--"}
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

function StatCard({ label, value, valueClass = "text-slate-800", small }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
      <div className="text-[11px] text-slate-400 font-semibold mb-1">{label}</div>
      <div className={`${small ? "text-base" : "text-2xl"} font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    completed: "bg-emerald-50 text-emerald-700",
    in_progress: "bg-amber-50 text-amber-700",
    abandoned: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${styles[status] || styles.abandoned}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// A single-series line chart, hand-rolled in SVG rather than pulling in a
// charting library the rest of the app doesn't use anywhere else. Fixed
// logical coordinate system (scaled responsively via viewBox), one
// accent color (the app's existing teal-700), thin 2px line with rounded
// caps, >=8px markers, light recessive gridlines - a single series
// doesn't need a legend, the chart title already names it.
const CHART_WIDTH = 600;
const CHART_HEIGHT = 220;
const CHART_PAD = { top: 16, right: 16, bottom: 28, left: 36 };

function ScoreChart({ points }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (points.length === 0) {
    return (
      <EmptyChartState>
        No completed assessments yet. Once you finish an assessment, its score will show up here.
      </EmptyChartState>
    );
  }

  if (points.length === 1) {
    return (
      <EmptyChartState>
        You have one completed assessment so far (score {points[0].overall_readiness_score}). Complete one more to
        start seeing a trend.
      </EmptyChartState>
    );
  }

  const plotWidth = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const plotHeight = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

  const xFor = (i) => CHART_PAD.left + (i / (points.length - 1)) * plotWidth;
  // Scores are 0-100 by construction (see feature_score's floor/ceiling),
  // so the y-axis can be fixed rather than auto-ranging to the data.
  const yFor = (score) => CHART_PAD.top + (1 - score / 100) * plotHeight;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.overall_readiness_score)}`)
    .join(" ");

  const gridScores = [0, 25, 50, 75, 100];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-auto" role="img" aria-label="Readiness score over time">
        {gridScores.map((score) => (
          <g key={score}>
            <line
              x1={CHART_PAD.left}
              x2={CHART_WIDTH - CHART_PAD.right}
              y1={yFor(score)}
              y2={yFor(score)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text x={CHART_PAD.left - 8} y={yFor(score) + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
              {score}
            </text>
          </g>
        ))}

        <path d={linePath} fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={p.session_id}>
            <circle
              cx={xFor(i)}
              cy={yFor(p.overall_readiness_score)}
              r={hoverIndex === i ? 6 : 4}
              fill="#0f766e"
              stroke="white"
              strokeWidth="1.5"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex((prev) => (prev === i ? null : prev))}
              style={{ cursor: "pointer" }}
            />
            {(i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 6) === 0) && (
              <text
                x={xFor(i)}
                y={CHART_HEIGHT - 8}
                // The first/last labels sit right at the plot edges - anchoring
                // them "middle" like the interior ones pushes half the text
                // past the viewBox and clips it, so the two ends anchor
                // outward instead.
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="fill-slate-400"
                fontSize="10"
              >
                {formatDate(p.started_at)}
              </text>
            )}
          </g>
        ))}
      </svg>

      {hoverIndex !== null && (
        <div
          className="absolute bg-slate-800 text-white text-xs rounded px-2 py-1 pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{
            left: `${(xFor(hoverIndex) / CHART_WIDTH) * 100}%`,
            top: `${(yFor(points[hoverIndex].overall_readiness_score) / CHART_HEIGHT) * 100}%`,
          }}
        >
          {formatDate(points[hoverIndex].started_at)} · {points[hoverIndex].overall_readiness_score}
        </div>
      )}
    </div>
  );
}

const SPARKLINE_WIDTH = 220;
const SPARKLINE_HEIGHT = 40;
const SPARKLINE_PAD = 4;

function Sparkline({ points, color }) {
  const values = points.map((p) => p.value).filter((v) => v !== null && v !== undefined);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // avoid divide-by-zero when every value is identical

  const plotWidth = SPARKLINE_WIDTH - SPARKLINE_PAD * 2;
  const plotHeight = SPARKLINE_HEIGHT - SPARKLINE_PAD * 2;

  const xFor = (i) => SPARKLINE_PAD + (i / (points.length - 1)) * plotWidth;
  const yFor = (v) => SPARKLINE_PAD + (1 - (v - min) / range) * plotHeight;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.value)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`} className="w-full h-auto" role="img" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureTrendCard({ feature }) {
  const style = SEVERITY_STYLES[feature.most_recent_severity] || SEVERITY_STYLES.unknown;
  const total = feature.in_range_count + feature.mild_count + feature.notable_count;

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-slate-700 text-sm">{feature.label}</div>
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${style.text}`}>
          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
          {style.label}
        </div>
      </div>

      {total > 0 ? (
        <>
          <Sparkline points={feature.points} color="#0f766e" />
          <div className="text-xs text-slate-400 mt-1">
            {feature.in_range_count} in range · {feature.mild_count} mild · {feature.notable_count} notable
          </div>
        </>
      ) : (
        <div className="text-xs text-slate-400 italic">Not enough data yet.</div>
      )}
    </div>
  );
}

function EmptyChartState({ children }) {
  return <div className="text-sm text-slate-500 text-center py-12">{children}</div>;
}

function CenteredMessage({ children, error }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <div className={`max-w-md text-center ${error ? "text-red-600" : "text-slate-600"}`}>{children}</div>
    </div>
  );
}

export default History;
