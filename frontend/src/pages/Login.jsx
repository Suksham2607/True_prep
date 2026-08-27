import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setToken } from "../services/api";
import styles from "./Login.module.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(null); // { text, color }
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (email.trim() === "" || password.trim() === "") {
      setMessage({ text: "Please enter email and password.", color: "red" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Real call to the backend instead of the old fake success message.
      const response = await api.post("/api/auth/login", { email, password });
      setToken(response.data.access_token);

      setMessage({ text: "Login successful! Opening dashboard...", color: "#087f8c" });
      setTimeout(() => navigate("/dashboard"), 500);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setMessage({
        text: detail || "Something went wrong. Please try again.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  function forgotPassword() {
    if (email.trim() === "") {
      alert("Please enter your email address first.");
    } else {
      alert("Password reset link will be sent to: " + email);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ================= LEFT ================= */}
        <div className={styles.leftSection}>
          <div className={styles.logo}>
            True <span>Predict</span>
          </div>

          <div className={styles.tag}>AI POWERED SYSTEM</div>

          <h1>
            Speak with <span>Confidence</span>
          </h1>

          <p className={styles.description}>
            True Predict is an AI-powered coach that helps you build
            communication confidence, ease speaking anxiety, and get ready
            for real interviews with real-time feedback.
          </p>

          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>🧠</div>
              <span>AI-Powered Confidence Coaching</span>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureIcon}>📊</div>
              <span>Real-Time Prediction</span>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureIcon}>🔒</div>
              <span>Secure User Experience</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT ================= */}
        <div className={styles.rightSection}>
          <h2 className={styles.loginTitle}>Welcome Back</h2>
          <p className={styles.loginSubtitle}>Login to continue to True Predict</p>

          <form onSubmit={handleSubmit}>
            {/* EMAIL */}
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* PASSWORD */}
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <div className={styles.passwordBox}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <span
                  className={styles.showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </span>
              </div>
            </div>

            {/* OPTIONS */}
            <div className={styles.options}>
              <label className={styles.remember}>
                <input type="checkbox" id="remember" />
                Remember me
              </label>

              <a href="#" className={styles.forgot} onClick={forgotPassword}>
                Forgot Password?
              </a>
            </div>

            {/* LOGIN */}
            <button type="submit" className={styles.loginBtn} disabled={loading}>
              {loading ? "LOGGING IN..." : "LOGIN"}
            </button>

            {/* DIVIDER */}
            <div className={styles.divider}>
              <span>OR</span>
            </div>

            {/* REGISTER */}
            <div className={styles.signup}>
              Don't have an account? <Link to="/register">Create Account</Link>
            </div>

            {/* MESSAGE */}
            {message && (
              <div className={styles.message} style={{ color: message.color }}>
                {message.text}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
