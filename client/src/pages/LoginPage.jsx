import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { Button, LoadingPage } from "../components/ui/index.jsx";
import styles from "../styles/design.module.css";
import companyLogo from "../assets/image.png";

export function LoginPage({ onAuthenticated }) {
  const [needsSetup, setNeedsSetup] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
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
      .then(({ needsSetup: value }) => setNeedsSetup(value))
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
  if (needsSetup === null) return <LoadingPage />;
  return (
    <main className={`${styles["login-screen"]}`}>
      <section className={`${styles["login-copy"]}`}>
        <img
          className={`${styles["login-logo"]}`}
          src={companyLogo}
          alt="Adiyogi Construction"
        />
        <p className={`${styles["eyebrow"]}`}>ADIYOGI CONSTRUCTION</p>
        <h1>
          Clear numbers.
          <br />
          <em>Calmer days.</em>
        </h1>
        <p>
          One secure workspace for workforce, attendance and payment decisions.
        </p>
        <div className={`${styles["login-points"]}`}>
          <span>✓ Labour records</span>
          <span>✓ Advance and due tracking</span>
          <span>✓ Bills ready to print or save as PDF</span>
        </div>
      </section>
      <section className={`${styles["login-card"]}`}>
        <img
          className={`${styles["brand-mobile"]}`}
          src={companyLogo}
          alt="Adiyogi Construction"
        />
        <p className={`${styles["eyebrow"]}`}>
          {needsSetup ? "FIRST-TIME SETUP" : "WELCOME BACK"}
        </p>
        <h2>
          {needsSetup
            ? "Create the owner account"
            : "Sign in to your workspace"}
        </h2>
        <p>
          {needsSetup
            ? "This owner can later add admins and control access."
            : "Use your administrator credentials to continue."}
        </p>
        <form onSubmit={submit} className={`${styles["form-stack"]}`}>
          {needsSetup && (
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
          <label className={`${styles["field"]}`}>
            <span>Password</span>
            <input
              required
              minLength="8"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimum 8 characters"
            />
          </label>
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
              placeholder="Enter the 6-character code"
            />
          </label>
          {error && <p className={`${styles["form-error"]}`}>{error}</p>}
          <Button
            type="submit"
            className={`${styles["button-primary"]} ${styles["button-block"]}`}
            loading={loading}
            disabled={loading || !captcha}
          >
            {needsSetup ? "Create secure workspace" : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
