import {
  NavLink,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import companyLogo from "../assets/image.png";
import {
  AdminsPage,
  AttendancePage,
  CompanyClientsPage,
  DashboardPage,
  PaymentsPage,
  ReportsPage,
  WorkersPage,
} from "../pages/index.js";
import styles from "../styles/design.module.css";

const labourNavGroups = [
  {
    label: "Overview",
    items: [
      ["/labour", "Dashboard", LayoutDashboard],
      ["/labour/reports", "Reports", ChartNoAxesCombined],
    ],
  },
  {
    label: "Work operations",
    items: [
      ["/labour/workers", "Workforce", UsersRound],
      ["/labour/companies", "Companies", Building2],
      ["/labour/attendance", "Attendance", CalendarDays],
      ["/labour/payments", "Payments", WalletCards],
    ],
  },
];

const labourRoutes = (user) => (
  <>
    <Route path="/labour" element={<DashboardPage />} />
    <Route path="/labour/workers" element={<WorkersPage />} />
    <Route
      path="/labour/companies"
      element={
        <CompanyClientsPage
          canEdit={["OWNER", "ADMIN"].includes(user.role)}
          isOwner={user.role === "OWNER"}
        />
      }
    />
    <Route path="/labour/attendance" element={<AttendancePage />} />
    <Route path="/labour/payments" element={<PaymentsPage />} />
    <Route path="/labour/reports" element={<ReportsPage />} />
  </>
);

const navLinkClass = (label, isActive) =>
  `${isActive ? styles.active : ""} ${label === "Dashboard" ? styles["nav-primary"] : ""}`;

export function AppShell({ session, onLogout }) {
  const user = session?.user;
  const [open, setOpen] = useState(false);
  const workspaceTitle = "Labour Management";
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    if (!open || !media.matches) return undefined;
    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    const handleViewportChange = () => {
      if (!media.matches) close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    media.addEventListener("change", handleViewportChange);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      media.removeEventListener("change", handleViewportChange);
    };
  }, [open, close]);
  if (!user?.name || !user?.role) return null;
  return (
    <div className={`${styles["app-shell"]}`}>
      <aside
        className={`${styles["sidebar"]} ${open ? styles["sidebar-open"] : ""}`}
      >
        <div className={`${styles["sidebar-brand"]}`}>
          <img
            className={`${styles["brand-logo"]}`}
            src={companyLogo}
            alt="Adiyogi Construction"
          />
          <div>
            <strong>Adiyogi Construction</strong>
            <span>Business Management</span>
          </div>
          <button
            className={`${styles["mobile-close"]} ${styles["icon-button"]}`}
            onClick={close}
            aria-label="Close navigation menu"
          >
            <X size={19} />
          </button>
        </div>
        <nav id="primary-navigation">
          {labourNavGroups.map((group) => (
            <div className={`${styles["nav-group"]}`} key={group.label}>
              <span className={`${styles["nav-group-label"]}`}>
                {group.label}
              </span>
              {group.items
                .filter(
                  ([, , , ownerOnly]) => !ownerOnly || user.role === "OWNER",
                )
                .map(([to, label, Icon]) => (
                  <NavLink
                    key={label}
                    to={to}
                    end={label === "Dashboard"}
                    onClick={close}
                    className={({ isActive }) =>
                      navLinkClass(label, isActive)
                    }
                  >
                    <Icon size={label === "Dashboard" ? 21 : 19} />
                    <span>{label}</span>
                  </NavLink>
                ))}
            </div>
          ))}
          {user.role === "OWNER" && (
            <NavLink
              to="/admins"
              onClick={close}
              className={({ isActive }) =>
                `${styles["admin-nav-link"]} ${isActive ? styles.active : ""}`
              }
            >
              <Settings size={19} />
              <span>Admin access</span>
            </NavLink>
          )}
        </nav>
        <div className={`${styles["profile"]}`}>
          <div className={`${styles["avatar"]}`}>
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
          <button
            className={`${styles["icon-button"]}`}
            title="Log out"
            onClick={onLogout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {open && (
        <button
          className={`${styles["sidebar-scrim"]}`}
          aria-label="Close menu"
          onClick={close}
        />
      )}
      <main className={`${styles["app-main"]}`}>
        <header className={`${styles["topbar"]}`}>
          <button
            className={`${styles["mobile-menu"]} ${styles["icon-button"]}`}
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={open}
            aria-controls="primary-navigation"
          >
            <Menu size={22} />
          </button>
          <div className={`${styles["topbar-context"]}`}>
            <span>{workspaceTitle}</span>
            <strong>
              {new Intl.DateTimeFormat("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date())}
            </strong>
          </div>
          <div className={`${styles["secure-note"]}`}>
            <ShieldCheck size={17} /> LABOUR workspace
          </div>
        </header>
        <div className={`${styles["page-wrap"]}`}>
          <Routes>
            <Route path="/" element={<Navigate to="/labour" replace />} />
            {labourRoutes(user)}
            <Route
              path="/admins"
              element={
                user.role === "OWNER" ? (
                  <AdminsPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
