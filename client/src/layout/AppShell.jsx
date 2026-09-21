import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  LayoutDashboard,
  LogOut,
  Menu,
  Paintbrush,
  Settings,
  ShieldCheck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import companyLogo from "../assets/image.png";
import {
  AdminsPage,
  AssignmentsPage,
  AttendancePage,
  ClientsPage,
  DashboardPage,
  PaymentsPage,
  ReportsPage,
  WorkersPage,
  DprPage,
  PaintPage,
} from "../pages/index.js";
import styles from "../styles/design.module.css";

const navGroups = [
  { label: "Overview", items: [["/", "Dashboard", LayoutDashboard]] },
  {
    label: "Workforce",
    items: [["/workers", "Workforce", UsersRound]],
  },
  {
    label: "Operations",
    items: [
      ["/clients", "Clients & Sites", Building2],
      ["/work", "Work Supply", BriefcaseBusiness],
      ["/dpr", "Daily DPR", CalendarDays],
      ["/paint", "Paint Ledger", Paintbrush],
    ],
  },
  {
    label: "Finance",
    items: [
      ["/payments", "Payments", WalletCards],
      ["/reports", "Reports", ChartNoAxesCombined],
    ],
  },
];

const navLinkClass = (to, label, isActive, location) => {
  const active =
    label === "Workforce"
      ? ["/workers", "/attendance"].includes(location.pathname)
      : to.startsWith("/workers?")
        ? `${location.pathname}${location.search}` === to
        : isActive;
  return `${active ? styles.active : ""} ${label === "Dashboard" ? styles["nav-primary"] : ""}`;
};

export function AppShell({ session, onLogout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const close = () => setOpen(false);
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
          >
            <X size={19} />
          </button>
        </div>
        <nav>
          {navGroups.map((group) => (
            <div className={`${styles["nav-group"]}`} key={group.label}>
              <span className={`${styles["nav-group-label"]}`}>
                {group.label}
              </span>
              {group.items.map(([to, label, Icon]) => (
                <NavLink
                  key={label}
                  to={to}
                  end={to === "/"}
                  onClick={close}
                  className={({ isActive }) =>
                    navLinkClass(to, label, isActive, location)
                  }
                >
                  <Icon size={label === "Dashboard" ? 21 : 19} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
          {session.user.role === "OWNER" && (
            <NavLink
              to="/admins"
              onClick={close}
              className={({ isActive }) =>
                isActive ? styles.active : undefined
              }
            >
              <Settings size={19} />
              <span>Admin access</span>
            </NavLink>
          )}
        </nav>
        <div className={`${styles["profile"]}`}>
          <div className={`${styles["avatar"]}`}>
            {session.user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{session.user.name}</strong>
            <span>{session.user.role}</span>
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
          >
            <Menu size={22} />
          </button>
          <div className={`${styles["topbar-context"]}`}>
            <span>Business Management System</span>
            <strong>
              {new Intl.DateTimeFormat("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date())}
            </strong>
          </div>
          <div className={`${styles["secure-note"]}`}>
            <ShieldCheck size={17} /> Secure workspace
          </div>
        </header>
        <div className={`${styles["page-wrap"]}`}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/workers" element={<WorkersPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/work" element={<AssignmentsPage />} />
            <Route path="/dpr" element={<DprPage />} />
            <Route path="/paint" element={<PaintPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route
              path="/admins"
              element={
                session.user.role === "OWNER" ? (
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
