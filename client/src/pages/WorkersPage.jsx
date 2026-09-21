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

function WorkerForm({ type, initial, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial || {
      type,
      name: "",
      phone: "",
      aadhaarNumber: "",
      skill: "",
      workZone: "",
      photoPath: "",
      ppeKitIssuedOn: "",
      defaultDailyRate: "",
      overtimeHourlyRate: "",
      joiningDate: inputDate(),
      address: "",
      notes: "",
    },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const update = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { photoPath, photoUrl, ...workerFields } = form;
      const body = {
        ...workerFields,
        defaultDailyRate: Number(form.defaultDailyRate || 0),
        overtimeHourlyRate: Number(form.overtimeHourlyRate || 0),
      };
      const data = initial
        ? await request(api.patch(`/workers/${initial._id}`, body))
        : await request(api.post("/workers", body));
      let worker = data.worker;
      if (photoFile) {
        const uploadData = new FormData();
        uploadData.append("photo", photoFile);
        const uploaded = await request(
          api.post(`/workers/${worker._id}/photo`, uploadData, {
            headers: { "Content-Type": "multipart/form-data" },
          }),
        );
        worker = uploaded.worker;
      }
      onSaved(worker);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={`${initial ? "Edit" : "Add"} ${typeTitle(type)}`}
      onClose={onClose}
    >
      <form className={`${styles["form-grid"]}`} onSubmit={save}>
        <Field label="Full name">
          <input
            required
            autoFocus
            value={form.name}
            onChange={update("name")}
            placeholder="Worker name"
          />
        </Field>
        <Field label="Mobile number" hint="Required">
          <input
            required
            value={form.phone || ""}
            onChange={update("phone")}
            placeholder="Mobile number"
          />
        </Field>
        <Field label="Aadhaar number" hint="Required">
          <input
            required
            inputMode="numeric"
            pattern="[0-9]{12}"
            maxLength="12"
            value={form.aadhaarNumber || ""}
            onChange={update("aadhaarNumber")}
            placeholder="12-digit Aadhaar number"
          />
        </Field>
        <Field label="Skill / role" hint="Required">
          <input
            required
            value={form.skill || ""}
            onChange={update("skill")}
            placeholder={
              type === "PAINTER" ? "e.g. Wall painter" : "e.g. Mason helper"
            }
          />
        </Field>
        <Field label="Current work zone">
          <input
            list="worker-zones"
            value={form.workZone || ""}
            onChange={update("workZone")}
            placeholder="Mumbai Zone or another location"
          />
          <datalist id="worker-zones">
            <option value="Mumbai Zone" />
            <option value="Chennai Zone" />
            <option value="Other" />
          </datalist>
        </Field>
        <Field label="Worker photo">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
          />
          {form.photoPath && (
            <small>Existing photo will remain unless replaced.</small>
          )}
        </Field>
        <Field label="PPE kit given on">
          <input
            type="date"
            value={form.ppeKitIssuedOn ? inputDate(form.ppeKitIssuedOn) : ""}
            onChange={update("ppeKitIssuedOn")}
          />
        </Field>
        <Field label="Default daily rate" hint="Required">
          <input
            required
            min="0"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.defaultDailyRate || ""}
            onChange={update("defaultDailyRate")}
            placeholder="₹ per day"
          />
        </Field>
        <Field
          label="OT rate per hour"
          hint="Used as the default overtime rate in attendance"
        >
          <input
            min="0"
            step="0.01"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.overtimeHourlyRate || ""}
            onChange={update("overtimeHourlyRate")}
            placeholder="₹ per OT hour"
          />
        </Field>
        <Field label="Joining date" hint="Required">
          <input
            required
            type="date"
            value={inputDate(form.joiningDate || new Date())}
            onChange={update("joiningDate")}
          />
        </Field>
        <Field label="Status">
          <select
            value={String(form.active ?? true)}
            onChange={(e) =>
              setForm({ ...form, active: e.target.value === "true" })
            }
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>
        <Field label="Address" hint="Required">
          <input
            required
            value={form.address || ""}
            onChange={update("address")}
            placeholder="Full address"
          />
        </Field>
        <Field label="Notes">
          <input
            value={form.notes || ""}
            onChange={update("notes")}
            placeholder="Optional notes"
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
          <Button
            type="submit"
            className={`${styles["button-primary"]}`}
            loading={saving}
          >
            Save {typeTitle(type)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function WorkerHistory({ worker, onClose }) {
  const [data, setData] = useState();
  const [error, setError] = useState("");
  useEffect(() => {
    request(api.get(`/workers/${worker._id}/history`))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [worker._id]);
  return (
    <Modal title={`${worker.name} · History`} onClose={onClose} wide>
      <ErrorNote error={error} />
      {!data ? (
        <Empty title="Loading history…" />
      ) : (
        <>
          <div className={`${styles["history-profile"]}`}>
            {worker.photoPath ? (
              <img
                src={`${import.meta.env.VITE_API_URL?.replace(/\/api$/, "") || "http://localhost:5000"}${worker.photoPath}`}
                alt={`${worker.name} profile`}
                className={`${styles["history-profile-photo"]}`}
              />
            ) : (
              <div className={`${styles["history-profile-placeholder"]}`}>
                {worker.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <h3>{worker.name}</h3>
              <p>
                {typeTitle(worker.type)} · {worker.skill || "Worker"}
              </p>
            </div>
          </div>
          <div className={`${styles["history-grid"]}`}>
            <Panel title="Attendance & payable">
              <div
                className={`${styles["metric-grid"]} ${styles["compact-metrics"]}`}
              >
                <Metric
                  label="Attendance days"
                  value={data.attendanceSummary?.days || 0}
                  tone="teal"
                />
                <Metric
                  label="Present days"
                  value={data.attendanceSummary?.presentDays || 0}
                  tone="teal"
                />
                <Metric
                  label="Double-work days"
                  value={data.attendanceSummary?.doubleDays || 0}
                  tone="purple"
                />
                <Metric
                  label="Total payable"
                  value={money(data.attendanceSummary?.totalPayable || 0)}
                  tone="amber"
                />
                <Metric
                  label="Paid"
                  value={money(data.attendanceSummary?.totalPaid || 0)}
                  tone="blue"
                />
                <Metric
                  label="Due"
                  value={money(data.attendanceSummary?.totalDue || 0)}
                  tone="coral"
                />
                <Metric
                  label="Extra paid"
                  value={`+${money(data.attendanceSummary?.overpaid || 0)}`}
                  tone="teal"
                  className={`${styles["payment-extra-metric"]}`}
                />
              </div>
            </Panel>
            <Panel
              title="Work assignments"
              detail="Sites and work periods linked to this worker."
            >
              <div className={`${styles["table-wrap"]}`}>
                <table>
                  <thead>
                    <tr>
                      <th>Site / client</th>
                      <th>Work</th>
                      <th>Start</th>
                      <th>Days</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assignments?.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <strong>{item.siteName}</strong>
                          <small>{item.client?.name || "—"}</small>
                        </td>
                        <td>{item.workDescription}</td>
                        <td>{date(item.startDate)}</td>
                        <td>{item.workDays || 0}</td>
                        <td>
                          <Status
                            tone={item.status === "ACTIVE" ? "teal" : "neutral"}
                          >
                            {item.status}
                          </Status>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.assignments?.length && (
                  <Empty title="No work assignments" />
                )}
              </div>
            </Panel>
            <Panel
              title="Daily work and attendance"
              detail="Every marked day, 2P day and overtime amount."
            >
              <div className={`${styles["table-wrap"]}`}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Site / work</th>
                      <th>Status</th>
                      <th>Units</th>
                      <th>OT</th>
                      <th>Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance?.map((item) => (
                      <tr key={item._id}>
                        <td>{date(item.date)}</td>
                        <td>
                          {item.assignment?.siteName || "—"}
                          <small>
                            {item.assignment?.workDescription ||
                              "Attendance record"}
                          </small>
                        </td>
                        <td>
                          <Status
                            tone={
                              item.status === "DOUBLE_PRESENT"
                                ? "purple"
                                : item.status === "PRESENT"
                                  ? "teal"
                                  : "neutral"
                            }
                          >
                            {item.status.replace("_", " ")}
                          </Status>
                        </td>
                        <td>{item.workUnits || 0}</td>
                        <td>
                          {item.overtimeHours || 0}h ×{" "}
                          {money(item.overtimeRate || 0)}
                        </td>
                        <td className={`${styles["amount"]}`}>
                          {money(item.payableAmount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.attendance?.length && (
                  <Empty title="No attendance records" />
                )}
              </div>
            </Panel>
            <Panel title="Payment history">
              <div className={`${styles["table-wrap"]}`}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Work record</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((item) => (
                      <tr key={item._id}>
                        <td>{date(item.paidOn)}</td>
                        <td>
                          <Status
                            tone={item.kind === "ADVANCE" ? "amber" : "teal"}
                          >
                            {item.kind.replace("_", " ")}
                          </Status>
                        </td>
                        <td>{item.assignment?.siteName || "—"}</td>
                        <td className={`${styles["amount"]}`}>
                          {money(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.payments.length && <Empty title="No payments" />}
              </div>
            </Panel>
          </div>
        </>
      )}
    </Modal>
  );
}

export function WorkersPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const type = params.get("type") === "PAINTER" ? "PAINTER" : "LABOUR";
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState();
  const [deleting, setDeleting] = useState();
  const [history, setHistory] = useState();
  const [error, setError] = useState("");
  const load = () =>
    request(api.get("/workers", { params: { type, search } }))
      .then(({ workers: result }) => setWorkers(result))
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [type, search]);
  const save = (worker) => {
    setForm(false);
    setEditing(null);
    setWorkers((current) =>
      current.some((item) => item._id === worker._id)
        ? current.map((item) => (item._id === worker._id ? worker : item))
        : [worker, ...current],
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="WORKFORCE"
        title={`${typeTitle(type)} management`}
        detail={`Maintain complete ${type.toLowerCase()} profiles, rates and history.`}
        action={
          <AddButton
            className={`${styles["button-primary"]}`}
            onClick={() => setForm(true)}
          >
            Add {typeTitle(type)}
          </AddButton>
        }
      />
      <SectionTabs
        value={type}
        showAttendance
        onChange={(value) => {
          if (value === "ATTENDANCE") {
            navigate("/attendance");
            return;
          }
          setParams({ type: value });
        }}
      />
      <Panel
        action={
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder={`Search ${type.toLowerCase()} by name…`}
          />
        }
      >
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>{typeTitle(type)}</th>
                <th>Photo</th>
                <th>Contact</th>
                <th>Skill</th>
                <th>Work zone</th>
                <th>PPE given</th>
                <th>Default rate</th>
                <th>OT / hour</th>
                <th>Status</th>
                <th>Payable</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker._id}>
                  <td>
                    <strong>{worker.name}</strong>
                    <small>Joined {date(worker.joiningDate)}</small>
                  </td>
                  <td>
                    {worker.photoPath ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL?.replace(/\/api$/, "") || "http://localhost:5000"}${worker.photoPath}`}
                        alt={`${worker.name} profile`}
                        width="42"
                        height="42"
                        style={{ objectFit: "cover", borderRadius: "50%" }}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{worker.phone || "—"}</td>
                  <td>{worker.skill || "—"}</td>
                  <td>{worker.workZone || "—"}</td>
                  <td>
                    {worker.ppeKitIssuedOn ? date(worker.ppeKitIssuedOn) : "—"}
                  </td>
                  <td className={`${styles["amount"]}`}>
                    {money(worker.defaultDailyRate)}/day
                  </td>
                  <td className={`${styles["amount"]}`}>
                    {money(worker.overtimeHourlyRate || 0)}/hr
                  </td>
                  <td>
                    <Status tone={worker.active ? "teal" : "neutral"}>
                      {worker.active ? "Active" : "Inactive"}
                    </Status>
                  </td>
                  <td>
                    <strong>{money(worker.totalDue || 0)}</strong>
                    <small>
                      Total payable {money(worker.totalPayable || 0)}
                    </small>
                    <small>Paid {money(worker.totalPaid || 0)}</small>
                    {(worker.overpaid || 0) > 0 && (
                      <small className={`${styles["payment-extra"]}`}>
                        +{money(worker.overpaid)} extra paid
                      </small>
                    )}
                  </td>
                  <td className={`${styles["actions"]}`}>
                    <button
                      className={`${styles["icon-button"]}`}
                      title="View history"
                      onClick={() => setHistory(worker)}
                    >
                      <History size={17} />
                    </button>
                    <button
                      className={`${styles["icon-button"]}`}
                      title="Edit worker"
                      onClick={() => setEditing(worker)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className={`${styles["icon-button"]} ${styles["delete-button"]}`}
                      title="Delete worker"
                      onClick={() => setDeleting(worker)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!workers.length && (
                <tr>
                  <td colSpan="11">
                    <Empty
                      title={`No ${type.toLowerCase()} records`}
                      detail={`Add your first ${type.toLowerCase()} to get started.`}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {form && (
        <WorkerForm type={type} onClose={() => setForm(false)} onSaved={save} />
      )}{" "}
      {editing && (
        <WorkerForm
          type={type}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={save}
        />
      )}{" "}
      {history && (
        <WorkerHistory worker={history} onClose={() => setHistory(null)} />
      )}
      {deleting && (
        <DeleteConfirm
          itemLabel={`${typeTitle(deleting.type)} ${deleting.name}`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request(api.delete(`/workers/${deleting._id}`));
            setWorkers((current) =>
              current.filter((item) => item._id !== deleting._id),
            );
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
