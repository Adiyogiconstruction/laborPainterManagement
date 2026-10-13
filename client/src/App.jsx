import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { request } from "./services/apiClient.js";
import { LoadingPage } from "./components/ui/index.jsx";
import { AppShell } from "./layout/AppShell.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";

const isValidSession = (session) =>
  Boolean(session?.user?.name && session?.user?.role);

const cachedSessionKey = "labour-management-session-user";

const readCachedSession = () => {
  try {
    const cached = JSON.parse(
      window.sessionStorage.getItem(cachedSessionKey) || "null",
    );
    if (!isValidSession(cached)) return null;
    return { user: { name: cached.user.name, role: cached.user.role } };
  } catch (error) {
    console.warn("Unable to read the cached administrator session.", error);
    return null;
  }
};

const writeCachedSession = (session) => {
  try {
    window.sessionStorage.setItem(
      cachedSessionKey,
      JSON.stringify({
        user: { name: session.user.name, role: session.user.role },
      }),
    );
  } catch (error) {
    console.warn("Unable to cache the administrator session.", error);
  }
};

const clearCachedSession = () => {
  try {
    window.sessionStorage.removeItem(cachedSessionKey);
  } catch (error) {
    console.warn("Unable to clear the cached administrator session.", error);
  }
};

export default function App() {
  const hasResetToken = new URLSearchParams(
    window.location.hash.slice(1),
  ).has("resetToken");
  const [session, setSession] = useState(() =>
    hasResetToken ? null : readCachedSession(),
  );
  const [checking, setChecking] = useState(!hasResetToken && !session);
  const navigate = useNavigate();
  useEffect(() => {
    if (hasResetToken) {
      clearCachedSession();
      return;
    }
    api
      .get("/auth/me")
      .then(({ data: { user } }) => {
        const nextSession = { user };
        if (!isValidSession(nextSession)) throw new Error("Invalid session");
        setSession(nextSession);
        writeCachedSession(nextSession);
      })
      .catch((error) => {
        if (error.response?.status === 401) {
          clearCachedSession();
          setSession(null);
        } else if (!session) {
          setSession(null);
          console.error("Unable to verify the administrator session.", error);
        } else {
          console.error(
            "Unable to refresh the administrator session; keeping the cached workspace visible.",
            error,
          );
        }
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
          clearCachedSession();
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
    const nextSession = { user };
    setSession(nextSession);
    writeCachedSession(nextSession);
    navigate("/");
  };
  const logout = async () => {
    await request(api.post("/auth/logout"));
    clearCachedSession();
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
