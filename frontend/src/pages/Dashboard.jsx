import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { clearToken } from "../services/api";
import styles from "./Dashboard.module.css";

// Sessions/scoring features don't exist yet (that's Milestones 4-7), so
// anything that depends on them shows this instead of a dead link.
function comingSoon() {
  alert("This part of TruePrep hasn't been built yet — coming in a later milestone.");
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function initialsFor(name) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "");
  return letters.join("") || "U";
}

function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // RequireAuth (in App.jsx) already guarantees there's a token before
    // this component ever mounts, so this effect can go straight to
    // fetching data.
    async function loadDashboard() {
      try {
        const [userRes, sessionsRes] = await Promise.all([
          api.get("/api/auth/me"),
          api.get("/api/sessions/"),
        ]);
        setUser(userRes.data);
        setSessions(sessionsRes.data);
      } catch {
        // The api.js response interceptor already redirects to /login on a
        // 401, so anything landing here is a real, unexpected failure.
        setError("Could not load your dashboard. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [navigate]);

  function logout() {
    clearToken();
    navigate("/login");
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ padding: "40px", textAlign: "center" }}>Loading your dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div style={{ padding: "40px", textAlign: "center", color: "#c53030" }}>{error}</div>
      </div>
    );
  }

  const mostRecent = sessions.length > 0 ? sessions[sessions.length - 1] : null;

  return (
    <div className={styles.page}>
      {/* ================= SIDEBAR ================= */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>TP</div>
          <div className={styles.brandName}>
            True<span>Predict</span>
          </div>
        </div>

        <div className={styles.menuTitle}>WORKSPACE</div>

        <button className={`${styles.menuItem} ${styles.menuItemActive}`}>
          <span className={styles.menuIcon}>▦</span>
          <span>Dashboard</span>
        </button>

        <button className={styles.menuItem} onClick={() => navigate("/consent")}>
          <span className={styles.menuIcon}>◉</span>
          <span>Detection</span>
        </button>

        <button className={styles.menuItem} onClick={comingSoon}>
          <span className={styles.menuIcon}>⌁</span>
          <span>Predictions</span>
        </button>

        <button className={styles.menuItem} onClick={comingSoon}>
          <span className={styles.menuIcon}>◷</span>
          <span>History</span>
        </button>

        <div className={styles.menuTitle} style={{ marginTop: "28px" }}>
          ACCOUNT
        </div>

        <button className={styles.menuItem} onClick={comingSoon}>
          <span className={styles.menuIcon}>◯</span>
          <span>Profile</span>
        </button>

        <button className={styles.menuItem} onClick={comingSoon}>
          <span className={styles.menuIcon}>⚙</span>
          <span>Settings</span>
        </button>

        <div className={styles.sidebarBottom}>
          <button className={styles.menuItem} onClick={logout}>
            <span className={styles.menuIcon}>↪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <main className={styles.main}>
        {/* TOPBAR */}
        <header className={styles.topbar}>
          <div className={styles.pageTitle}>Dashboard</div>

          <div className={styles.topRight}>
            <button
              className={styles.notification}
              onClick={() => alert("No new notifications.")}
            >
              🔔
            </button>

            <div className={styles.profile}>
              <div className={styles.avatar}>{initialsFor(user?.name)}</div>
              <div className={styles.profileName}>{user?.name}</div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <section className={styles.content}>
          <div className={styles.welcome}>
            <h1>Welcome back 👋</h1>
            <p>Monitor your anxiety analysis and prediction activity.</p>
          </div>

          {/* HERO */}
          <div className={styles.hero}>
            <div>
              <h2>Ready for a new assessment?</h2>
              <p>
                Start a real-time assessment and let TruePredict analyze your
                inputs using the trained machine learning model.
              </p>
            </div>

            <button className={styles.startBtn} onClick={() => navigate("/consent")}>
              Start Assessment →
            </button>
          </div>

          {/* STATS */}
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>TOTAL ASSESSMENTS</div>
              <div className={styles.statValue}>{sessions.length}</div>
              <div className={styles.statStatus}>
                {sessions.length === 0 ? "No assessments yet" : "Practice sessions recorded"}
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statLabel}>LAST ANXIETY SCORE</div>
              <div className={styles.statValue}>
                {mostRecent?.overall_readiness_score ?? "--"}
              </div>
              <div className={styles.statStatus}>
                {/* Scoring isn't built yet (Milestone 7) - stays a placeholder until then */}
                Awaiting assessment
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statLabel}>MODEL STATUS</div>
              <div className={styles.statValue}>Ready</div>
              <div className={styles.statStatus}>● System operational</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statLabel}>ACCOUNT</div>
              <div className={styles.statValue}>Active</div>
              <div className={styles.statStatus}>
                {user?.has_given_consent ? "Consent given" : "Consent required"}
              </div>
            </div>
          </div>

          {/* DASHBOARD GRID */}
          <div className={styles.dashboardGrid}>
            {/* QUICK ACTIONS */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Quick actions</h2>
              </div>

              <div className={styles.actions}>
                <button className={styles.action} onClick={() => navigate("/consent")}>
                  <div className={styles.actionIcon}>🧠</div>
                  <h3>New Assessment</h3>
                  <p>Start a real-time anxiety detection session.</p>
                </button>

                <button className={styles.action} onClick={comingSoon}>
                  <div className={styles.actionIcon}>📊</div>
                  <h3>Latest Prediction</h3>
                  <p>Review your latest prediction result.</p>
                </button>

                <button className={styles.action} onClick={comingSoon}>
                  <div className={styles.actionIcon}>📈</div>
                  <h3>View History</h3>
                  <p>Explore previous assessment results.</p>
                </button>

                <button className={styles.action} onClick={comingSoon}>
                  <div className={styles.actionIcon}>👤</div>
                  <h3>My Profile</h3>
                  <p>Manage your account information.</p>
                </button>
              </div>
            </div>

            {/* RECENT ACTIVITY */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Recent activity</h2>
                <button className={styles.viewAll} onClick={comingSoon}>
                  View all
                </button>
              </div>

              {sessions.length === 0 ? (
                <>
                  <div className={styles.record}>
                    <div>
                      <div className={styles.recordTitle}>No assessment</div>
                      <div className={styles.recordDate}>Start your first assessment</div>
                    </div>
                    <span className={`${styles.badge} ${styles.low}`}>Pending</span>
                  </div>

                  <div className={styles.record}>
                    <div>
                      <div className={styles.recordTitle}>Prediction history</div>
                      <div className={styles.recordDate}>No records available</div>
                    </div>
                    <span className={`${styles.badge} ${styles.moderate}`}>Empty</span>
                  </div>
                </>
              ) : (
                sessions
                  .slice()
                  .reverse()
                  .map((session) => (
                    <div className={styles.record} key={session.id}>
                      <div>
                        <div className={styles.recordTitle}>Session #{session.id}</div>
                        <div className={styles.recordDate}>{formatDate(session.started_at)}</div>
                      </div>
                      <span className={`${styles.badge} ${styles.low}`}>{session.status}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
