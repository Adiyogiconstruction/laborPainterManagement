import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { request } from "./services/apiClient.js";
import { LoadingPage } from "./components/ui/index.jsx";
import { AppShell } from "./layout/AppShell.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";

const isValidSession = (session) =>
  Boolean(session?.user?.name && session?.user?.role);

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(
    !new URLSearchParams(window.location.hash.slice(1)).has("resetToken"),
  );
  const navigate = useNavigate();
  useEffect(() => {
    if (new URLSearchParams(window.location.hash.slice(1)).has("resetToken")) {
      setChecking(false);
      return;
    }
    request(api.get("/auth/me"))
      .then(({ user }) => {
        const nextSession = { user };
        if (!isValidSession(nextSession)) throw new Error("Invalid session");
        setSession(nextSession);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    let heartbeatInProgress = false;
    const heartbeat = async () => {
      if (heartbeatInProgress) return;
      heartbeatInProgress = true;
      try {
        await api.post("/auth/session/heartbeat");
      } catch (error) {
        if (error.response?.status === 401 && active) {
          setSession(null);
          navigate("/");
        } else {
          console.error("Unable to update administrator activity.", error);
        }
      } finally {
        heartbeatInProgress = false;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") heartbeat();
    };
    heartbeat();
    const intervalId = window.setInterval(heartbeat, 10 * 60 * 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session, navigate]);
  const authenticated = (data) => {
    if (!isValidSession(data)) throw new Error("Invalid login response.");
    const { user } = data;
    setSession({ user });
    navigate("/");
  };
  const logout = async () => {
    await request(api.post("/auth/logout"));
    setSession(null);
    navigate("/");
  };
  if (checking) return <LoadingPage />;
  return session ? (
    <AppShell session={session} onLogout={logout} />
  ) : (
    <LoginPage onAuthenticated={authenticated} />
  );
}
