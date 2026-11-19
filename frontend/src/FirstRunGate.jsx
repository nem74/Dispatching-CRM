
import { useEffect, useState } from "react";
import AuthGate from "./AuthGate.jsx";

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "var(--lc-bg)",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },

  card: {
    width: "100%",
    maxWidth: "420px",
    background: "var(--lc-panel)",
    borderRadius: "16px",
    padding: "32px",
    color: "var(--lc-text)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
  },

  input: {
    display: "block",
    width: "100%",
    padding: "12px",
    marginTop: "8px",
    marginBottom: "18px",
    borderRadius: "8px",
    border: "1px solid var(--lc-border)",
    boxSizing: "border-box",
    background: "var(--lc-input)",
    color: "var(--lc-text)",
  },

  button: {
    width: "100%",
    padding: "13px",
    border: "none",
    borderRadius: "8px",
    background: "var(--lc-accent)",
    color: "var(--lc-on-accent)",
    fontSize: "15px",
    cursor: "pointer",
  },
};

export default function FirstRunGate() {
  const [mode, setMode] = useState("loading");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function checkSetup() {
    try {
      const response = await fetch(
        "/api/auth/setup/status",
        {
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Setup check failed: HTTP ${response.status}`
        );
      }

      const data = await response.json();

      setMode(data.needs_setup ? "setup" : "login");
    } catch (err) {
      setError(err.message);
      setMode("error");
    }
  }

  useEffect(() => {
    checkSetup();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 14) {
      setError(
        "Your password must contain at least 14 characters."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/setup/create",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to create account."
        );
      }

      setPassword("");
      setConfirmPassword("");

      // Switch to the existing login interface.
      setMode("login");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "login") {
    return <AuthGate />;
  }

  if (mode === "loading") {
    return (
      <div style={styles.page}>
        <p>Starting LaneCove...</p>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>LaneCove</h2>
          <p>Could not connect to the setup service.</p>
          <p style={{ color: "#b91c1c" }}>{error}</p>

          <button
            style={styles.button}
            onClick={() => {
              setError("");
              setMode("loading");
              checkSetup();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <form
        style={styles.card}
        onSubmit={handleSubmit}
      >
        <h1 style={{ marginBottom: "4px" }}>
          LaneCove
        </h1>

        <p style={{ color: "var(--lc-muted)" }}>
          Welcome! Create your first administrator
          account to get started.
        </p>

        <label htmlFor="setup-username">
          Username
        </label>

        <input
          id="setup-username"
          style={styles.input}
          value={username}
          autoComplete="username"
          onChange={(e) =>
            setUsername(e.target.value)
          }
          minLength={3}
          maxLength={40}
          pattern="[A-Za-z0-9_.-]+"
          required
        />

        <label htmlFor="setup-password">
          Password
        </label>

        <input
          id="setup-password"
          type="password"
          style={styles.input}
          value={password}
          autoComplete="new-password"
          onChange={(e) =>
            setPassword(e.target.value)
          }
          minLength={14}
          required
        />

        <label htmlFor="setup-confirm">
          Confirm Password
        </label>

        <input
          id="setup-confirm"
          type="password"
          style={styles.input}
          value={confirmPassword}
          autoComplete="new-password"
          onChange={(e) =>
            setConfirmPassword(e.target.value)
          }
          required
        />

        {error && (
          <p style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          style={styles.button}
          disabled={submitting}
        >
          {submitting
            ? "Creating account..."
            : "Create Account"}
        </button>
      </form>
    </div>
  );
}
