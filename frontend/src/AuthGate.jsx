
import { useEffect, useState } from "react";

import {
  Truck,
  LockKeyhole,
  LogOut,
  Eye,
  EyeOff,
  ShieldCheck
} from "lucide-react";

import App from "./App.jsx";
import "./auth.css";


async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `Request failed (${response.status})`
    );
  }

  return data;
}


export default function AuthGate() {
  const [status, setStatus] = useState("checking");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");


  // =====================================
  // CHECK EXISTING SESSION
  // =====================================

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", {
      credentials: "same-origin",
      cache: "no-store"
    })
      .then(async (response) => {
        if (response.status === 401) {
          return null;
        }

        return readResponse(response);
      })
      .then((data) => {
        if (!active) return;

        if (data?.authenticated) {
          setAccount(data.username);
          setStatus("authenticated");
        } else {
          setStatus("login");
        }
      })
      .catch((err) => {
        if (!active) return;

        setError(
          `Unable to check session: ${err.message}`
        );
        setStatus("login");
      });

    return () => {
      active = false;
    };
  }, []);


  // =====================================
  // LOGIN
  // =====================================

  async function handleLogin(event) {
    event.preventDefault();

    if (working) return;

    setWorking(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });

      const data = await readResponse(response);

      setPassword("");
      setAccount(data.username);
      setStatus("authenticated");

    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }


  // =====================================
  // LOGOUT
  // =====================================

  async function handleLogout() {
    if (working) return;

    setWorking(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      await readResponse(response);

      setAccount("");
      setPassword("");
      setStatus("login");

    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }


  // =====================================
  // CHECKING SESSION
  // =====================================

  if (status === "checking") {
    return (
      <div className="auth-loading">
        <Truck size={30} />
        <p>Checking your session...</p>
      </div>
    );
  }


  // =====================================
  // AUTHENTICATED APPLICATION
  // =====================================

  if (status === "authenticated") {
    return (
      <>
        <App />

        <button
          className="auth-signout"
          onClick={handleLogout}
          disabled={working}
          title={`Signed in as ${account}`}
        >
          <LogOut size={16} />
          {working ? "Signing out..." : "Sign out"}
        </button>

        {error && (
          <div className="auth-logout-error">
            {error}
          </div>
        )}
      </>
    );
  }


  // =====================================
  // LOGIN SCREEN
  // =====================================

  return (
    <div className="auth-page">

      <div className="auth-container">

        <div className="auth-brand">
          <span className="auth-logo">
            <Truck size={23} />
          </span>

          <div>
            <strong>Silvanne</strong>
            <small>CARRIER FINDER</small>
          </div>
        </div>

        <div className="auth-card">

          <div className="auth-lock">
            <LockKeyhole size={24} />
          </div>

          <h1>Welcome back</h1>

          <p className="auth-subtitle">
            Sign in to access your carrier
            prospecting and dispatch workspace.
          </p>

          <form onSubmit={handleLogin}>

            <label>
              Username

              <input
                type="text"
                required
                autoComplete="username"
                minLength={3}
                maxLength={50}
                placeholder="Enter your username"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
              />
            </label>

            <label>
              Password

              <div className="auth-password-wrap">

                <input
                  required
                  type={
                    showPassword ? "text" : "password"
                  }
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                />

                <button
                  type="button"
                  className="auth-eye"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>

              </div>
            </label>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={working}
            >
              {working ? "Signing in..." : "Sign in"}
            </button>

          </form>

          <div className="auth-security-note">
            <ShieldCheck size={17} />
            <span>
              Private, password-protected workspace.
            </span>
          </div>

        </div>

        <p className="auth-footer">
          Silvanne Carrier Finder
          <span> · </span>
          Local development
        </p>

      </div>

    </div>
  );
}
