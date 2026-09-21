import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { request } from "./services/apiClient.js";
import { LoadingPage } from "./components/ui/index.jsx";
import { AppShell } from "./layout/AppShell.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    const token = localStorage.getItem("workledger_token");
    if (!token) return setChecking(false);
    request(api.get("/auth/me"))
      .then(({ user }) => setSession({ token, user }))
      .catch(() => localStorage.removeItem("workledger_token"))
      .finally(() => setChecking(false));
  }, []);
  const authenticated = ({ token, user }) => {
    localStorage.setItem("workledger_token", token);
    setSession({ token, user });
    navigate("/");
  };
  const logout = () => {
    localStorage.removeItem("workledger_token");
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
