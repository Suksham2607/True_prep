import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import styles from "./Register.module.css";

function Register() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [message, setMessage] = useState(null); // { text, color }
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (password.length < 6) {
      setMessage({ text: "Password must contain at least 6 characters.", color: "#d64545" });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ text: "Passwords do not match.", color: "#d64545" });
      return;
    }

    if (!terms) {
      setMessage({ text: "Please accept the Terms of Service to continue.", color: "#d64545" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // The backend only stores one "name" field, so first + last name
      // are combined here before sending.
      await api.post("/api/auth/register", {
        name: `${firstName} ${lastName}`.trim(),
        email,
        password,
      });

      setMessage({ text: "Account created successfully. Redirecting...", color: "#0b7285" });
      setTimeout(() => navigate("/login"), 1000);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setMessage({
        text: detail || "Something went wrong. Please try again.",
        color: "#d64545",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.navbar}>
        <Link to="/login" className={styles.brand}>
          <div className={styles.brandLogo}>TP</div>
          <div className={styles.brandName}>
            True<span>Predict</span>
          </div>
        </Link>

        <Link to="/login" className={styles.back}>
          ← Back to Sign In
        </Link>
      </header>

      <main className={styles.pageBody}>
        <div className={styles.registerCard}>
          {/* LEFT */}
          <section className={styles.side}>
            <h1>
              Start your <span>AI journey.</span>
            </h1>
            <p>
              Create your TruePredict account and start building the
              confidence and communication skills you need to ace your next
              interview.
            </p>

            <div className={styles.benefits}>
              <div className={styles.benefit}>
                <div className={styles.check}>✓</div>
                AI-powered confidence coaching
              </div>
              <div className={styles.benefit}>
                <div className={styles.check}>✓</div>
                Real-time analysis
              </div>
              <div className={styles.benefit}>
                <div className={styles.check}>✓</div>
                Personal prediction history
              </div>
              <div className={styles.benefit}>
                <div className={styles.check}>✓</div>
                Secure user workspace
              </div>
            </div>
          </section>

          {/* FORM */}
          <section className={styles.formArea}>
            <h2>Create account</h2>
            <p className={styles.subtitle}>Enter your details to create your workspace.</p>

            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label htmlFor="firstName">First name</label>
                  <input
                    type="text"
                    id="firstName"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="lastName">Last name</label>
                  <input
                    type="text"
                    id="lastName"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email">Email address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label htmlFor="password">Password</label>
                  <div className={styles.passwordBox}>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={styles.show}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <div className={styles.passwordBox}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={styles.show}
                      onClick={() => setShowConfirmPassword((v) => !v)}
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.terms}>
                <input
                  type="checkbox"
                  id="terms"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  required
                />
                <label htmlFor="terms">
                  I agree to the <a href="#">Terms of Service</a> and{" "}
                  <a href="#">Privacy Policy</a>.
                </label>
              </div>

              <button type="submit" className={styles.createBtn} disabled={loading}>
                {loading ? "CREATING..." : "Create Account"}
              </button>

              {message && (
                <div className={styles.formMessage} style={{ color: message.color }}>
                  {message.text}
                </div>
              )}

              <div className={styles.login}>
                Already have an account? <Link to="/login">Sign in</Link>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Register;
