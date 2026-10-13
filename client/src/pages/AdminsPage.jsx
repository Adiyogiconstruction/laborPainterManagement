import styles from "../styles/design.module.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  FileDown,
  FilePlus2,
  History,
  IndianRupee,
  Landmark,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  Trash2,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { date, inputDate, money, number } from "../utils/formatters.js";
import {
  AddButton,
  Button,
  DeleteConfirm,
  Empty,
  Field,
  Modal,
  PageHeader,
  Panel,
  SearchBox,
  Status,
} from "../components/ui/index.jsx";
import {
  ErrorNote,
  Metric,
  SectionTabs,
  errorMessage,
  typeClass,
  typeTitle,
} from "./shared.jsx";

function AdminForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ADMIN",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { user } = await request(api.post("/auth/admins", form));
      onSaved(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Add administrator" onClose={onClose}>
      <form className={`${styles["form-grid"]}`} onSubmit={save}>
        <Field label="Name">
          <input
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Temporary password">
          <input
            required
            minLength="8"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="Access role">
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="ADMIN">Admin — manage daily records</option>
            <option value="VIEWER">Viewer — reports only</option>
          </select>
        </Field>
        <div className={`${styles["modal-actions"]}`}>
          <ErrorNote error={error} />
          <Button
            type="button"
            className={`${styles["button-ghost"]}`}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className={`${styles["button-primary"]}`} loading={saving}>
            Create admin
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordForm({ user, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(
        api.patch(`/auth/admins/${user.id}/password`, { password }),
      );
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Reset password for ${user.name}`} onClose={onClose}>
      <form className={`${styles["form-grid"]}`} onSubmit={save}>
        <Field label="New temporary password">
          <input
            required
            autoFocus
            minLength="8"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 8 characters"
          />
        </Field>
        <div className={`${styles["modal-actions"]}`}>
          <ErrorNote error={error} />
          <Button
            type="button"
            className={`${styles["button-ghost"]}`}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className={`${styles["button-primary"]}`} loading={saving}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CompanyProfileForm({ profile, onSaved }) {
  const formFromProfile = (value) => ({
    companyName: value?.companyName || "",
    address: value?.address || "",
    mobile: value?.mobile || "",
    email: value?.email || "",
    gstin: value?.gstin || "",
    pan: value?.pan || "",
    rules: (value?.rules || []).join("\n"),
  });
  const [form, setForm] = useState(() => formFromProfile(profile));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));
  const cancelEditing = () => {
    setForm(formFromProfile(profile));
    setError("");
    setEditing(false);
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { profile: savedProfile } = await request(
        api.patch("/company-profile", {
          ...form,
          rules: form.rules
            .split("\n")
            .map((rule) => rule.trim())
            .filter(Boolean),
        }),
      );
      setForm(formFromProfile(savedProfile));
      setEditing(false);
      onSaved(savedProfile);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Panel
      title="Company and PDF rules"
      detail="These details appear on worker profile PDFs."
      action={
        editing ? (
          <Button
            type="button"
            className={`${styles["button-ghost"]}`}
            onClick={cancelEditing}
            disabled={saving}
          >
            Cancel
          </Button>
        ) : (
          <Button
            type="button"
            icon={Pencil}
            className={`${styles["button-secondary"]}`}
            onClick={() => setEditing(true)}
          >
            Edit details
          </Button>
        )
      }
    >
      <form className={`${styles["form-grid"]}`} onSubmit={save}>
        <Field label="Company name">
          <input
            required
            disabled={!editing || saving}
            value={form.companyName}
            onChange={update("companyName")}
          />
        </Field>
        <Field label="Mobile">
          <input
            disabled={!editing || saving}
            value={form.mobile}
            onChange={update("mobile")}
          />
        </Field>
        <Field label="Email">
          <input
            disabled={!editing || saving}
            type="email"
            value={form.email}
            onChange={update("email")}
          />
        </Field>
        <Field label="GSTIN">
          <input
            disabled={!editing || saving}
            value={form.gstin}
            onChange={update("gstin")}
          />
        </Field>
        <Field label="PAN">
          <input
            disabled={!editing || saving}
            value={form.pan}
            onChange={update("pan")}
          />
        </Field>
        <Field label="Address">
          <input
            disabled={!editing || saving}
            value={form.address}
            onChange={update("address")}
          />
        </Field>
        <Field label="PDF rules" hint="One rule per line">
          <textarea
            disabled={!editing || saving}
            rows="6"
            value={form.rules}
            onChange={update("rules")}
          />
        </Field>
        <ErrorNote error={error} />
        {editing && (
          <div className={`${styles["modal-actions"]}`}>
            <Button className={`${styles["button-primary"]}`} loading={saving}>
              Save company details
            </Button>
          </div>
        )}
      </form>
    </Panel>
  );
}

export function AdminsPage() {
  const currentUsageDate = () =>
    new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
  const [users, setUsers] = useState([]);
  const [usageRows, setUsageRows] = useState([]);
  const [usageFrom, setUsageFrom] = useState(currentUsageDate);
  const [usageTo, setUsageTo] = useState(currentUsageDate);
  const [usageAdmin, setUsageAdmin] = useState("");
  const [usagePage, setUsagePage] = useState(1);
  const [usagePageSize, setUsagePageSize] = useState(10);
  const [appliedUsageFilters, setAppliedUsageFilters] = useState(() => ({
    from: currentUsageDate(),
    to: currentUsageDate(),
    admin: "",
  }));
  const [activityAdmin, setActivityAdmin] = useState("");
  const [activityAction, setActivityAction] = useState("");
  const [activityFrom, setActivityFrom] = useState("");
  const [activityTo, setActivityTo] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityPages, setActivityPages] = useState({});
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");
  const [usageLoading, setUsageLoading] = useState(false);
  const [companyProfile, setCompanyProfile] = useState();
  const dateTime = (value) =>
    value
      ? new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(value))
      : "—";
  const load = () =>
    request(api.get("/auth/admins/activity"))
      .then(({ admins: list }) => setUsers(list))
      .catch((err) => setError(errorMessage(err)));
  const loadUsage = async (
    from = appliedUsageFilters.from,
    to = appliedUsageFilters.to,
  ) => {
    setUsageLoading(true);
    setUsageRows([]);
    try {
      const { rows } = await request(
        api.get("/auth/admins/usage", {
          params: { from, to },
        }),
      );
      setUsageRows(rows);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUsageLoading(false);
    }
  };
  useEffect(() => {
    load();
    request(api.get("/company-profile"))
      .then(({ profile }) => setCompanyProfile(profile))
      .catch((err) => setError(errorMessage(err)));
  }, []);
  useEffect(() => {
    loadUsage(appliedUsageFilters.from, appliedUsageFilters.to);
  }, []);
  useEffect(() => {
    const refreshUsage = () => {
      if (document.visibilityState === "visible") {
        loadUsage(appliedUsageFilters.from, appliedUsageFilters.to);
      }
    };
    const intervalId = window.setInterval(refreshUsage, 10 * 60 * 1000);
    document.addEventListener("visibilitychange", refreshUsage);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshUsage);
    };
  }, [appliedUsageFilters.from, appliedUsageFilters.to]);
  const visibleUsageRows = usageRows.filter(
    (row) =>
      !appliedUsageFilters.admin || row.userId === appliedUsageFilters.admin,
  );
  const usagePageCount = Math.max(
    1,
    Math.ceil(visibleUsageRows.length / usagePageSize),
  );
  const currentUsagePage = Math.min(usagePage, usagePageCount);
  const paginatedUsageRows = visibleUsageRows.slice(
    (currentUsagePage - 1) * usagePageSize,
    currentUsagePage * usagePageSize,
  );
  const totalUsageMilliseconds = visibleUsageRows.reduce(
    (total, row) => total + row.totalMilliseconds,
    0,
  );
  const formatDuration = (milliseconds) => {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  };
  const periodDate = (value) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00.000Z`));
  const downloadUsagePdf = async () => {
    setError("");
    try {
      const { downloadAdminUsagePdf } = await import(
        "../utils/adminUsagePdf.js"
      );
      const selectedAdmin = users.find(
        (user) => user.id === appliedUsageFilters.admin,
      );
      downloadAdminUsagePdf({
        profile: companyProfile,
        filters: {
          from: appliedUsageFilters.from,
          to: appliedUsageFilters.to,
          adminName: selectedAdmin?.name || "",
        },
        rows: visibleUsageRows,
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const changeActivityPage = (userId, nextPage) => {
    setActivityPages((current) => ({ ...current, [userId]: nextPage }));
  };
  const filteredActivitiesFor = (user, activities = user.activities || []) => {
    const query = activitySearch.trim().toLocaleLowerCase();
    return activities.filter((activity) => {
      const createdAt = activity.createdAt ? new Date(activity.createdAt) : null;
      const createdDate = createdAt
        ? `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(createdAt.getDate()).padStart(2, "0")}`
        : "";
      if (activityAction && activity.action !== activityAction) return false;
      if (activityFrom && (!createdDate || createdDate < activityFrom)) {
        return false;
      }
      if (activityTo && (!createdDate || createdDate > activityTo)) {
        return false;
      }
      if (
        query &&
        ![activity.action, activity.message, user.name, user.email].some(
          (value) =>
            String(value || "")
              .toLocaleLowerCase()
              .includes(query),
        )
      ) {
        return false;
      }
      return true;
    });
  };
  const filteredChangesFor = (user) =>
    filteredActivitiesFor(user, user.recentChanges || []);
  const visibleActivityUsers = users.filter(
    (user) =>
      (!activityAdmin || user.id === activityAdmin) &&
      filteredActivitiesFor(user).length > 0,
  );
  const downloadActivity = async (user) => {
    setError("");
    try {
      const { downloadAdminActivityPdf } = await import(
        "../utils/adminActivityPdf.js"
      );
      downloadAdminActivityPdf({
        user,
        profile: companyProfile,
        activities: filteredActivitiesFor(user),
        filters: {
          activity: activityAction,
          fromDate: activityFrom,
          toDate: activityTo,
          search: activitySearch.trim(),
        },
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const changeActive = async (user) => {
    try {
      const { user: changed } = await request(
        api.patch(`/auth/admins/${user.id}`, { active: !user.active }),
      );
      setUsers((current) =>
        current.map((item) => (item.id === changed.id ? changed : item)),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const deleteAdmin = async () => {
    const { deletedId } = await request(
      api.delete(`/auth/admins/${deleting.id}/permanent`),
    );
    setUsers((current) => current.filter((item) => item.id !== deletedId));
    setUsageRows((current) =>
      current.filter((item) => item.userId !== deletedId),
    );
    if (usageAdmin === deletedId) setUsageAdmin("");
    if (appliedUsageFilters.admin === deletedId) {
      setAppliedUsageFilters((current) => ({ ...current, admin: "" }));
    }
    setDeleting(null);
  };
  return (
    <>
      <PageHeader
        title="Admin access"
        detail="User activity and time report"
      />
      <Panel
        title="Workspace team"
        detail="Owners can create, disable, or permanently remove non-owner accounts."
        action={
          <AddButton
            className={`${styles["button-primary"]}`}
            onClick={() => setAdding(true)}
          >
            Add administrator
          </AddButton>
        }
      >
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Role</th>
                <th>Created</th>
                <th>Access</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </td>
                  <td>
                    <Status tone={user.role === "OWNER" ? "purple" : "blue"}>
                      {user.role}
                    </Status>
                  </td>
                  <td>{date(user.createdAt)}</td>
                  <td>
                    <Status tone={user.active ? "teal" : "neutral"}>
                      {user.active ? "Active" : "Disabled"}
                    </Status>
                  </td>
                  <td>
                    {user.role !== "OWNER" && (
                      <div className={styles["admin-actions"]}>
                        <Button
                          type="button"
                          className={`${styles["button-secondary"]}`}
                          onClick={() => setResetting(user)}
                        >
                          Reset password
                        </Button>
                        <Button
                          type="button"
                          className={
                            user.active
                              ? `${styles["button-danger"]}`
                              : `${styles["button-primary"]}`
                          }
                          onClick={() => changeActive(user)}
                        >
                          {user.active ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          type="button"
                          className={`${styles["button-danger"]}`}
                          onClick={() => setDeleting(user)}
                          aria-label={`Permanently delete ${user.name}`}
                          title="Delete permanently"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Date-wise user activity"
        className={styles["admin-usage-panel"]}
        detail="Logged-in time includes idle time while the app remains open. Logout stops it immediately; if the browser closes, time ends at the last 10-minute activity check."
        action={
          <div className={styles["admin-usage-actions"]}>
            <Button
              type="button"
              className={`${styles["button-ghost"]}`}
              onClick={() => loadUsage()}
              loading={usageLoading}
              aria-label="Refresh usage"
              title="Refresh usage"
            >
              <RefreshCcw size={15} />
            </Button>
          </div>
        }
      >
        <div className={`${styles["admin-usage-filters"]}`}>
          <Field label="From date">
            <input
              required
              type="date"
              value={usageFrom}
              max={usageTo || undefined}
              onChange={(event) => setUsageFrom(event.target.value)}
            />
          </Field>
          <Field label="To date">
            <input
              required
              type="date"
              value={usageTo}
              min={usageFrom || undefined}
              onChange={(event) => setUsageTo(event.target.value)}
            />
          </Field>
          <Field label="Administrator">
            <select
              value={usageAdmin}
              onChange={(event) => setUsageAdmin(event.target.value)}
            >
              <option value="">All administrators</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>
          <div className={styles["admin-usage-filter-actions"]}>
            <Button
              type="button"
              className={`${styles["button-primary"]}`}
              onClick={() => {
                setUsagePage(1);
                setAppliedUsageFilters({
                  from: usageFrom,
                  to: usageTo,
                  admin: usageAdmin,
                });
                loadUsage(usageFrom, usageTo);
              }}
              disabled={!usageFrom || !usageTo || usageFrom > usageTo}
            >
              Apply
            </Button>
            <Button
              type="button"
              className={`${styles["button-ghost"]}`}
              onClick={() => {
                const today = currentUsageDate();
                setUsageFrom(today);
                setUsageTo(today);
                setUsageAdmin("");
                setUsagePage(1);
                setAppliedUsageFilters({ from: today, to: today, admin: "" });
                loadUsage(today, today);
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              className={`${styles["button-pdf"]}`}
              onClick={downloadUsagePdf}
              disabled={!visibleUsageRows.length}
            >
              <FileDown size={15} /> PDF
            </Button>
          </div>
        </div>
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Administrator</th>
                <th>Logged-in time</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsageRows.length ? (
                paginatedUsageRows.map((row) => (
                  <tr key={`${row.userId}-${row.date}`}>
                    <td>{periodDate(row.date)}</td>
                    <td>
                      <strong>{row.userName}</strong>
                    </td>
                    <td>{formatDuration(row.totalMilliseconds)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3">
                    {usageLoading
                      ? "Loading usage…"
                      : "No website usage recorded for these dates."}
                  </td>
                </tr>
              )}
            </tbody>
            {visibleUsageRows.length > 0 && (
              <tfoot>
                <tr>
                  <th colSpan="2">Total logged-in time</th>
                  <th>{formatDuration(totalUsageMilliseconds)}</th>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {visibleUsageRows.length > 0 && (
          <div className={styles["workforce-pagination"]}>
            <label>
              Show
              <select
                value={usagePageSize}
                onChange={(event) => {
                  setUsagePageSize(Number(event.target.value));
                  setUsagePage(1);
                }}
                aria-label="Usage rows per page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              rows
            </label>
            <span>
              Showing {(currentUsagePage - 1) * usagePageSize + 1}–
              {Math.min(currentUsagePage * usagePageSize, visibleUsageRows.length)}{" "}
              of {visibleUsageRows.length}
            </span>
            <div>
              <Button
                type="button"
                className={`${styles["button-secondary"]}`}
                onClick={() => setUsagePage(currentUsagePage - 1)}
                disabled={currentUsagePage <= 1}
              >
                Previous
              </Button>
              <Button
                type="button"
                className={`${styles["button-secondary"]}`}
                onClick={() => setUsagePage(currentUsagePage + 1)}
                disabled={currentUsagePage >= usagePageCount}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
      <Panel
        title="Access activity"
        detail="Owner-only record of login times, logout times and all recorded admin actions."
        className={styles["admin-access-activity-panel"]}
        action={
          <Button
            type="button"
            className={`${styles["button-secondary"]}`}
            onClick={load}
          >
            Refresh
          </Button>
        }
      >
        <div className={styles["admin-activity-filters"]}>
          <SearchBox
            value={activitySearch}
            onChange={setActivitySearch}
            placeholder="Search admin or activity"
          />
          <Field label="Administrator">
            <select
              value={activityAdmin}
              onChange={(event) => setActivityAdmin(event.target.value)}
            >
              <option value="">All administrators</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Activity">
            <select
              value={activityAction}
              onChange={(event) => setActivityAction(event.target.value)}
            >
              <option value="">All activities</option>
              {[
                "LOGIN",
                "LOGOUT",
                "SETUP",
                "CREATE",
                "UPDATE",
                "DELETE",
                "PASSWORD_RESET",
                "ACCESS_TOGGLE",
                "ROLE_CHANGE",
              ].map((action) => (
                <option key={action} value={action}>
                  {action.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From date">
            <input
              type="date"
              value={activityFrom}
              max={activityTo || undefined}
              onChange={(event) => setActivityFrom(event.target.value)}
            />
          </Field>
          <Field label="To date">
            <input
              type="date"
              value={activityTo}
              min={activityFrom || undefined}
              onChange={(event) => setActivityTo(event.target.value)}
            />
          </Field>
        </div>
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Last login</th>
                <th>Last logout</th>
                <th>All changes</th>
                <th>Full activity</th>
              </tr>
            </thead>
            <tbody>
              {visibleActivityUsers.map((user) => {
                const matchingActivities = filteredActivitiesFor(user);
                const recentChanges = filteredChangesFor(user);
                const lastLogin = matchingActivities.find(
                  (activity) => activity.action === "LOGIN",
                );
                const lastLogout = matchingActivities.find(
                  (activity) => activity.action === "LOGOUT",
                );
                return (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <small>{user.role}</small>
                    </td>
                    <td>{dateTime(lastLogin?.createdAt)}</td>
                    <td>{dateTime(lastLogout?.createdAt)}</td>
                    <td>
                      {recentChanges.length ? (() => {
                        const page = Math.min(
                          activityPages[user.id] || 0,
                          recentChanges.length - 1,
                        );
                        const event = recentChanges[page];
                        return (
                          <div className={`${styles["admin-activity-change"]}`}>
                            <div className={`${styles["admin-activity-entry"]}`}>
                              <small>{dateTime(event.createdAt)}</small>
                              <span>{event.message}</span>
                            </div>
                            <div className={`${styles["admin-activity-pager"]}`}>
                              <button
                                type="button"
                                className={`${styles["button-secondary"]}`}
                                aria-label={`Previous change for ${user.name}`}
                                onClick={() =>
                                  changeActivityPage(user.id, page - 1)
                                }
                                disabled={page === 0}
                              >
                                <ChevronLeft size={14} />
                              </button>
                              <small>
                                {page + 1} / {recentChanges.length}
                              </small>
                              <button
                                type="button"
                                className={`${styles["button-secondary"]}`}
                                aria-label={`Next change for ${user.name}`}
                                onClick={() =>
                                  changeActivityPage(user.id, page + 1)
                                }
                                disabled={page >= recentChanges.length - 1}
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })() : (
                        <span style={{ color: "#7a8c89", fontSize: "11px" }}>
                          No admin changes recorded.
                        </span>
                      )}
                    </td>
                    <td>
                      <Button
                        type="button"
                        className={`${styles["button-secondary"]}`}
                        onClick={() => downloadActivity(user)}
                      >
                        <FileDown size={15} /> Download PDF
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!visibleActivityUsers.length && (
                <tr>
                  <td colSpan="5">
                    <Empty title="No matching admin activity" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {companyProfile && (
        <CompanyProfileForm
          profile={companyProfile}
          onSaved={setCompanyProfile}
        />
      )}
      {adding && (
        <AdminForm
          onClose={() => setAdding(false)}
          onSaved={(user) => {
            setAdding(false);
            setUsers((current) => [user, ...current]);
            loadUsage();
          }}
        />
      )}
      {resetting && (
        <ResetPasswordForm
          user={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => setResetting(null)}
        />
      )}
      {deleting && (
        <DeleteConfirm
          itemLabel={`administrator ${deleting.name} (${deleting.email}) and their login sessions`}
          onClose={() => setDeleting(null)}
          onConfirm={deleteAdmin}
        />
      )}
    </>
  );
}
