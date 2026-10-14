import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api, { request } from "../services/apiClient.js";
import { Button, LoadingPage } from "../components/ui/index.jsx";
import styles from "../styles/design.module.css";
import companyLogo from "../assets/image.png";

export function LoginPage({ onAuthenticated }) {
  const navigate = useNavigate();
  const [needsSetup, setNeedsSetup] = useState(null);
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    setupKey: "",
  });
  const [recoveryMode, setRecoveryMode] = useState("login");
  const [resetToken, setResetToken] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get("resetToken") || "",
  );
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState("");
  const [captcha, setCaptcha] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refreshCaptcha = async () => {
    setCaptcha(null);
    setForm((current) => ({ ...current, captchaCode: "" }));
    try {
      setCaptcha(await request(api.get("/auth/captcha")));
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => {
    request(api.get("/auth/setup-status"))
      .then(({ needsSetup: value, setupAvailable: available }) => {
        setNeedsSetup(value);
        setSetupAvailable(Boolean(available));
      })
      .catch((err) => {
        setNeedsSetup(false);
        setError(err.message);
      });
  }, []);
  useEffect(() => {
    refreshCaptcha();
  }, []);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await request(
        api.post(needsSetup ? "/auth/setup" : "/auth/login", {
          ...form,
          captchaToken: captcha.token,
        }),
      );
      onAuthenticated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const requestPasswordRecovery = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const result = await request(
        api.post("/auth/password-reset/request", {
          email: form.email,
          captchaCode: form.captchaCode,
          captchaToken: captcha.token,
        }),
      );
      setSuccess(result.message);
      setRecoveryMode("sent");
    } catch (err) {
      setError(err.message);
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };
  const resetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (form.password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const result = await request(
        api.post("/auth/password-reset/confirm", {
          token: resetToken,
          password: form.password,
        }),
      );
      setSuccess(result.message);
      setResetToken("");
      setRecoveryMode("login");
      setConfirmPassword("");
      setForm((current) => ({ ...current, password: "" }));
      navigate(`${window.location.pathname}${window.location.search}`, {
        replace: true,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const openRecovery = () => {
    setRecoveryMode("request");
    setError("");
    setSuccess("");
    refreshCaptcha();
  };
  const returnToLogin = () => {
    setRecoveryMode("login");
    setError("");
    setSuccess("");
    setForm((current) => ({ ...current, password: "", captchaCode: "" }));
    refreshCaptcha();
  };
  const leavePasswordReset = () => {
    setResetToken("");
    setRecoveryMode("login");
    setError("");
    navigate(`${window.location.pathname}${window.location.search}`, {
      replace: true,
    });
  };
  if (needsSetup === null) return <LoadingPage />;
  return (
    <main className={`${styles["login-screen"]}`}>
      <section className={`${styles["login-copy"]}`}>
        <img
          className={`${styles["login-logo"]}`}
          src={companyLogo}
          alt="Adiyogi Construction"
        />
        <h1 className={`${styles["login-company-name"]}`}>
          Adiyogi Construction
        </h1>
        <p className={`${styles["login-company-tagline"]}`}>
          Reliable workforce. Stronger construction.
        </p>
      </section>
      <section className={`${styles["login-card"]}`}>
        <div className={`${styles["login-mobile-brand"]}`}>
          <img
            className={`${styles["brand-mobile"]}`}
            src={companyLogo}
            alt="Adiyogi Construction"
          />
          <strong className={`${styles["brand-mobile-name"]}`}>
            Adiyogi Construction
          </strong>
          <span className={`${styles["brand-mobile-tagline"]}`}>
            Reliable workforce. Stronger construction.
          </span>
        </div>
        <p className={`${styles["eyebrow"]}`}>
          {resetToken
            ? "PASSWORD RECOVERY"
            : recoveryMode === "request" || recoveryMode === "sent"
              ? "OWNER ACCOUNT RECOVERY"
              : needsSetup
                ? "FIRST-TIME SETUP"
                : "WELCOME BACK"}
        </p>
        <h2>
          {resetToken
            ? "Choose a new password"
            : recoveryMode === "request"
              ? "Reset owner password"
              : recoveryMode === "sent"
                ? "Check your email"
                : needsSetup
                  ? "Create the owner account"
                  : "Sign in to your workspace"}
        </h2>
        <p>
          {resetToken
            ? "Choose a new password for your owner account. The recovery link can only be used once."
            : recoveryMode === "request"
              ? "Enter the registered owner email. We’ll verify it before sending a one-time recovery link."
              : recoveryMode === "sent"
                ? "If an active owner account exists for that email, a recovery link will arrive shortly."
                : needsSetup
                  ? "This owner can later add admins and control access."
                  : "Use your administrator credentials to continue."}
        </p>
        {resetToken ? (
          <form onSubmit={resetPassword} className={`${styles["form-stack"]}`}>
            <label className={`${styles["field"]}`}>
              <span>New password</span>
              <input
                required
                minLength="8"
                maxLength="128"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                placeholder="8–128 characters"
              />
            </label>
            <label className={`${styles["field"]}`}>
              <span>Confirm new password</span>
              <input
                required
                minLength="8"
                maxLength="128"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter the new password again"
              />
            </label>
            {error && <p className={`${styles["form-error"]}`}>{error}</p>}
            {success && <p className={`${styles["form-success"]}`}>{success}</p>}
            <Button
              type="submit"
              className={`${styles["button-primary"]} ${styles["button-block"]}`}
              loading={loading}
            >
              Set new password
            </Button>
            <Button
              type="button"
              icon={ArrowLeft}
              className={`${styles["button-secondary"]} ${styles["button-block"]}`}
              onClick={leavePasswordReset}
              disabled={loading}
            >
              Back to sign in
            </Button>
          </form>
        ) : recoveryMode === "sent" ? (
          <div className={`${styles["form-stack"]}`}>
            {success && <p className={`${styles["form-success"]}`}>{success}</p>}
            <Button
              type="button"
              icon={ArrowLeft}
              className={`${styles["button-secondary"]} ${styles["button-block"]}`}
              onClick={returnToLogin}
            >
              Back to sign in
            </Button>
          </div>
        ) : needsSetup && !setupAvailable ? (
          <p className={`${styles["form-error"]}`}>
            Initial owner setup is locked until the system operator configures
            the private owner setup key on the server. Contact the system
            operator; do not share the key publicly.
          </p>
        ) : (
        <form
          onSubmit={recoveryMode === "request" ? requestPasswordRecovery : submit}
          className={`${styles["form-stack"]}`}
        >
          {needsSetup && recoveryMode === "login" && (
            <>
              <label className={`${styles["field"]}`}>
                <span>Your name</span>
                <input
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Aditya Kumar"
                />
              </label>
              <label className={`${styles["field"]}`}>
                <span>Private owner setup key</span>
                <input
                  required
                  minLength="32"
                  type="password"
                  autoComplete="off"
                  value={form.setupKey}
                  onChange={(e) =>
                    setForm({ ...form, setupKey: e.target.value })
                  }
                  placeholder="Provided privately by the system operator"
                />
              </label>
            </>
          )}
          <label className={`${styles["field"]}`}>
            <span>Email address</span>
            <input
              required
              type="email"
              autoFocus={!needsSetup}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@company.com"
            />
          </label>
          {recoveryMode === "login" && (
            <label className={`${styles["field"]}`}>
              <span>Password</span>
              <input
                required
                minLength="8"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                placeholder="Minimum 8 characters"
              />
            </label>
          )}
          <label className={`${styles["field"]}`}>
            <span>Verification code</span>
            <div className={`${styles["captcha-challenge"]}`}>
              {captcha ? (
                <img
                  className={`${styles["captcha-image"]}`}
                  src={captcha.image}
                  alt="CAPTCHA verification code"
                />
              ) : (
                <span className={`${styles["captcha-image"]}`}>
                  Loading code…
                </span>
              )}
              <button
                className={`${styles["icon-button"]}`}
                type="button"
                onClick={refreshCaptcha}
                disabled={loading}
                aria-label="Get a new verification code"
                title="Get a new verification code"
              >
                <RefreshCw size={18} />
              </button>
            </div>
            <input
              required
              autoComplete="off"
              maxLength="6"
              pattern="[A-HJ-NP-Z2-9]{6}"
              value={form.captchaCode || ""}
              onChange={(e) =>
                setForm({ ...form, captchaCode: e.target.value.toUpperCase() })
              }
              placeholder="6-character code"
            />
          </label>
          {error && <p className={`${styles["form-error"]}`}>{error}</p>}
          {success && <p className={`${styles["form-success"]}`}>{success}</p>}
          <Button
            type="submit"
            className={`${styles["button-primary"]} ${styles["button-block"]}`}
            loading={loading}
            disabled={loading || !captcha || (needsSetup && !setupAvailable)}
          >
            {recoveryMode === "request"
              ? "Send recovery link"
              : needsSetup
                ? "Create secure workspace"
                : "Sign in"}
          </Button>
          {!needsSetup && (
            <Button
              type="button"
              icon={
                recoveryMode === "request" ? ArrowLeft : KeyRound
              }
              className={
                recoveryMode === "request"
                  ? `${styles["button-secondary"]} ${styles["button-block"]}`
                  : styles["login-recovery-link"]
              }
              onClick={
                recoveryMode === "request" ? returnToLogin : openRecovery
              }
              disabled={loading}
            >
              {recoveryMode === "request" ? "Back to sign in" : "Forgot password?"}
            </Button>
          )}
        </form>
        )}
      </section>
    </main>
  );
}
