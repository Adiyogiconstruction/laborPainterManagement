import styles from "../styles/design.module.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  FilePlus2,
  History,
  IndianRupee,
  Landmark,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { date, inputDate, money, number } from "../utils/formatters.js";
import {
  AddButton,
  Button,
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
  const [form, setForm] = useState({
    companyName: profile?.companyName || "",
    address: profile?.address || "",
    mobile: profile?.mobile || "",
    email: profile?.email || "",
    gstin: profile?.gstin || "",
    pan: profile?.pan || "",
    rules: (profile?.rules || []).join("\n"),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));
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
    >
      <form className={`${styles["form-grid"]}`} onSubmit={save}>
        <Field label="Company name">
          <input
            required
            value={form.companyName}
            onChange={update("companyName")}
          />
        </Field>
        <Field label="Mobile">
          <input value={form.mobile} onChange={update("mobile")} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={update("email")} />
        </Field>
        <Field label="GSTIN">
          <input value={form.gstin} onChange={update("gstin")} />
        </Field>
        <Field label="PAN">
          <input value={form.pan} onChange={update("pan")} />
        </Field>
        <Field label="Address">
          <input value={form.address} onChange={update("address")} />
        </Field>
        <Field label="PDF rules" hint="One rule per line">
          <textarea rows="6" value={form.rules} onChange={update("rules")} />
        </Field>
        <div className={`${styles["modal-actions"]}`}>
          <ErrorNote error={error} />
          <Button className={`${styles["button-primary"]}`} loading={saving}>
            Save company details
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function AdminsPage() {
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [error, setError] = useState("");
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
  useEffect(() => {
    load();
    request(api.get("/company-profile"))
      .then(({ profile }) => setCompanyProfile(profile))
      .catch((err) => setError(errorMessage(err)));
  }, []);
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
  return (
    <>
      <PageHeader
        eyebrow="SECURE ACCESS"
        title="Admin access"
        detail="Only authorised people can view or manage business records."
        action={
          <AddButton
            className={`${styles["button-primary"]}`}
            onClick={() => setAdding(true)}
          >
            Add administrator
          </AddButton>
        }
      />
      <Panel
        title="Workspace team"
        detail="Owners can create accounts and switch an account off whenever needed."
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
                      <div className={`${styles["actions-inline"]}`}>
                        <button
                          className={`${styles["text-button"]}`}
                          onClick={() => setResetting(user)}
                        >
                          Reset password
                        </button>
                        <button
                          className={`${styles["text-button"]}`}
                          onClick={() => changeActive(user)}
                        >
                          {user.active ? "Disable" : "Enable"}
                        </button>
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
        title="Access activity"
        detail="Owner-only record of login times, logout times and recent admin actions."
      >
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Last login</th>
                <th>Last logout</th>
                <th>Recent changes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>{user.role}</small>
                  </td>
                  <td>{dateTime(user.lastLoginAt)}</td>
                  <td>{dateTime(user.lastLogoutAt)}</td>
                  <td>
                    {user.recentChanges?.length ? (
                      <div
                        style={{
                          display: "grid",
                          gap: "6px",
                          maxWidth: "360px",
                        }}
                      >
                        {user.recentChanges.slice(0, 3).map((event) => (
                          <div
                            key={`${user.id}-${event.createdAt}-${event.message}`}
                            style={{
                              display: "grid",
                              gap: "2px",
                              padding: "6px 8px",
                              borderRadius: "8px",
                              background: "#f6faf9",
                              border: "1px solid #edf2f0",
                            }}
                          >
                            <small
                              style={{ color: "#526662", fontWeight: 700 }}
                            >
                              {dateTime(event.createdAt)}
                            </small>
                            <span style={{ fontSize: "11px", lineHeight: 1.4 }}>
                              {event.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "#7a8c89", fontSize: "11px" }}>
                        No admin changes recorded.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="How roles work">
        <div className={`${styles["role-grid"]}`}>
          <div>
            <strong>Owner</strong>
            <p>
              Full control, including adding administrators and viewing every
              report.
            </p>
          </div>
          <div>
            <strong>Admin</strong>
            <p>Can add and update workers, attendance and payments.</p>
          </div>
          <div>
            <strong>Viewer</strong>
            <p>
              Can securely review records and reports without editing financial
              data.
            </p>
          </div>
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
    </>
  );
}
