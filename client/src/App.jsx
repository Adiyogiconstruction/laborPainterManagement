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
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
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
