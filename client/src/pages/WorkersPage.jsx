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
  Download,
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

const apiOrigin = (import.meta.env.VITE_API_URL || "/api").replace(
  /\/api\/?$/,
  "",
);

const imageUrl = (worker, urlField, legacyPathField) => {
  const value = worker[urlField] || worker[legacyPathField];
  return value?.startsWith("http") ? value : `${apiOrigin}${value || ""}`;
};

const exportColumns = [
  ["Name", "name"],
  ["Team", "teamName"],
  ["Phone", "phone"],
  ["Aadhaar number", "aadhaarNumber"],
  ["Address", "address"],
  ["Skill", "skill"],
  ["Work zone", "workZone"],
  ["Joining date", "joiningDate"],
  ["PPE kit given", "ppeKitIssuedOn"],
  ["Default daily rate", "defaultDailyRate"],
  ["OT hourly rate", "overtimeHourlyRate"],
  ["Status", "active"],
  ["Notes", "notes"],
];

const exportValue = (worker, key) => {
  if (key === "active") return worker.active ? "Active" : "Inactive";
  if (key === "joiningDate" || key === "ppeKitIssuedOn") {
    return worker[key] ? date(worker[key]) : "";
  }
  return worker[key] ?? "";
};

const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
const htmlValue = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function printWorkers(workers, type) {
  const printWindow = window.open("", "_blank", "width=1200,height=800");
  if (!printWindow) return;
  const headers = exportColumns.map(([label]) => `<th>${label}</th>`).join("");
  const rows = workers
    .map(
      (worker) =>
        `<tr>${exportColumns
          .map(
            ([, key]) =>
              `<td>${String(exportValue(worker, key)).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  printWindow.document.write(
    `<!doctype html><html><head><title>${typeTitle(type)} workforce</title><style>body{font-family:Arial,sans-serif;color:#192827}h1{font-size:20px;font-weight:600}p{color:#71817e;font-size:12px;font-weight:400}table{border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:9px;line-height:1.3;font-weight:400}th,td{border:1px solid #dce8e5;padding:5px;text-align:left;vertical-align:top;font-family:Arial,sans-serif;font-size:9px;line-height:1.3;font-weight:400}th{background:#e3f4f0}</style></head><body><h1>${typeTitle(type)} workforce</h1><p>${workers.length} records</p><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`,
  );
  printWindow.document.close();
  printWindow.onload = () => {
    const attendanceTable = printWindow.document.querySelector("table");
    attendanceTable
      ?.querySelectorAll("th:nth-child(2), td:nth-child(2)")
      .forEach((cell) => cell.remove());
    printWindow.print();
  };
}

function printWorkerProfile(worker, data, period) {
  const printWindow = window.open("", "_blank", "width=1200,height=900");
  if (!printWindow) return;
  const rows = (items, columns) =>
    items
      .map(
        (item) =>
          `<tr>${columns.map((column) => `<td>${htmlValue(column(item))}</td>`).join("")}</tr>`,
      )
      .join("");
  const summary = data.attendanceSummary || {};
  const periodText =
    period.from || period.to
      ? `${period.from || "Beginning"} to ${period.to || "Today"}`
      : "All time";
  printWindow.document.write(
    `<!doctype html><html><head><title>${htmlValue(worker.name)} worker report</title><style>body{font-family:Arial,sans-serif;color:#192827;padding:24px}h1{margin:0 0 4px;font-size:22px}h2{margin:24px 0 8px;font-size:14px;border-bottom:1px solid #dce8e5;padding-bottom:6px}p{color:#71817e;font-size:11px;margin:4px 0}table{border-collapse:collapse;width:100%;font-size:10px;margin-top:8px}th,td{border:1px solid #dce8e5;padding:6px;text-align:left;vertical-align:top}th{background:#e3f4f0;text-transform:uppercase;font-size:9px}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:14px}.metric{border:1px solid #dce8e5;padding:9px}.metric strong{display:block;font-size:15px}.metric span{font-size:9px;color:#71817e}</style></head><body><h1>${htmlValue(worker.name)}</h1><p>${htmlValue(typeTitle(worker.type))} · ${htmlValue(worker.skill || "Worker")} · Report period: ${htmlValue(periodText)}</p><p>Phone: ${htmlValue(worker.phone)} · Team: ${htmlValue(worker.teamName || "—")} · Work zone: ${htmlValue(worker.workZone || "—")}</p><div class="summary"><div class="metric"><strong>${summary.days || 0}</strong><span>Attendance days</span></div><div class="metric"><strong>${summary.presentDays || 0}</strong><span>Present days</span></div><div class="metric"><strong>${summary.doubleDays || 0}</strong><span>Double-work days</span></div><div class="metric"><strong>${htmlValue(money(summary.totalPayable || 0))}</strong><span>Total payable</span></div><div class="metric"><strong>${htmlValue(money(summary.totalPaid || 0))}</strong><span>Paid</span></div></div><h2>Attendance</h2><table><thead><tr><th>Date</th><th>Site / work</th><th>Status</th><th>Units</th><th>Payable</th></tr></thead><tbody>${rows(data.attendance || [], [(item) => date(item.date), (item) => item.assignment?.siteName || "—", (item) => item.status, (item) => item.workUnits || 0, (item) => money(item.payableAmount || 0)])}</tbody></table><h2>Work assignments</h2><table><thead><tr><th>Site / client</th><th>Work</th><th>Start</th><th>Days</th><th>Status</th></tr></thead><tbody>${rows(data.assignments || [], [(item) => item.siteName, (item) => item.workDescription, (item) => date(item.startDate), (item) => item.workDays || 0, (item) => item.status])}</tbody></table><h2>Payment history</h2><table><thead><tr><th>Date</th><th>Type</th><th>Work record</th><th>Amount</th></tr></thead><tbody>${rows(data.payments || [], [(item) => date(item.paidOn), (item) => item.kind, (item) => item.assignment?.siteName || "—", (item) => money(item.amount)])}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`,
  );
  printWindow.document.close();
  printWindow.onload = () => {
    const tables = printWindow.document.querySelectorAll("table");
    tables[0]
      ?.querySelectorAll("th:nth-child(2), td:nth-child(2)")
      .forEach((cell) => cell.remove());
    tables[2]
      ?.querySelectorAll("th:nth-child(3), td:nth-child(3)")
      .forEach((cell) => cell.remove());
    printWindow.print();
  };
}

function WorkerForm({ type, initial, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial || {
      type,
      name: "",
      teamName: "",
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
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState(null);
  const update = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!initial && (!aadhaarFrontFile || !aadhaarBackFile)) {
        throw new Error("Please select both Aadhaar front and back images.");
      }
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
      if (aadhaarFrontFile || aadhaarBackFile) {
        if (!aadhaarFrontFile || !aadhaarBackFile) {
          throw new Error("Please select both Aadhaar front and back images.");
        }
        const aadhaarData = new FormData();
        aadhaarData.append("aadhaarFront", aadhaarFrontFile);
        aadhaarData.append("aadhaarBack", aadhaarBackFile);
        const uploaded = await request(
          api.post(`/workers/${worker._id}/aadhaar`, aadhaarData, {
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
        {type === "LABOUR" && (
          <Field label="Labour team" hint="Optional">
            <input
              value={form.teamName || ""}
              onChange={update("teamName")}
              placeholder="e.g. Team A or Ramesh crew"
            />
          </Field>
        )}
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
        <Field label="Aadhaar card - front" hint="Required for new workers">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            required={!initial && !form.aadhaarFrontPath}
            onChange={(event) =>
              setAadhaarFrontFile(event.target.files?.[0] || null)
            }
          />
          {form.aadhaarFrontPath && (
            <small>Existing front image will remain unless replaced.</small>
          )}
        </Field>
        <Field label="Aadhaar card - back" hint="Required for new workers">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            required={!initial && !form.aadhaarBackPath}
            onChange={(event) =>
              setAadhaarBackFile(event.target.files?.[0] || null)
            }
          />
          {form.aadhaarBackPath && (
            <small>Existing back image will remain unless replaced.</small>
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState({ from: "", to: "" });
  useEffect(() => {
    setData(undefined);
    setError("");
    request(api.get(`/workers/${worker._id}/history`, { params: period }))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [worker._id, period]);
  const applyPeriod = (event) => {
    event.preventDefault();
    setPeriod({ from, to });
  };
  return (
    <Modal
      title={`${worker.name} · History`}
      onClose={onClose}
      wide
      action={
        <Button
          icon={Printer}
          className={`${styles["button-secondary"]}`}
          disabled={!data}
          onClick={() => printWorkerProfile(worker, data, period)}
        >
          PDF
        </Button>
      }
    >
      <ErrorNote error={error} />
      <form
        className={`${styles["toolbar"]} ${styles["filter-bar"]}`}
        onSubmit={applyPeriod}
      >
        <Field label="From date">
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </Field>
        <Field label="To date">
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </Field>
        <Button type="submit" className={`${styles["button-primary"]}`}>
          Apply filter
        </Button>
        <Button
          type="button"
          className={`${styles["button-ghost"]}`}
          onClick={() => {
            setFrom("");
            setTo("");
            setPeriod({ from: "", to: "" });
          }}
        >
          All time
        </Button>
      </form>
      {!data ? (
        <Empty title="Loading history…" />
      ) : (
        <>
          <div className={`${styles["history-profile"]}`}>
            {worker.photoPath ? (
              <img
                src={imageUrl(worker, "photoUrl", "photoPath")}
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
          <Panel
            title="Identity documents"
            detail={`Aadhaar number: ${worker.aadhaarNumber || "Not provided"}`}
          >
            <div className={`${styles["aadhaar-documents"]}`}>
              {[
                ["Front", worker.aadhaarFrontPath],
                ["Back", worker.aadhaarBackPath],
              ].map(([label, path]) => (
                <figure className={`${styles["aadhaar-document"]}`} key={label}>
                  {path ? (
                    <img
                      src={
                        path.startsWith("http") ? path : `${apiOrigin}${path}`
                      }
                      alt={`${worker.name} Aadhaar card ${label.toLowerCase()}`}
                      className={`${styles["aadhaar-document-image"]}`}
                    />
                  ) : (
                    <div className={`${styles["aadhaar-document-missing"]}`}>
                      Not uploaded
                    </div>
                  )}
                  <figcaption>Aadhaar {label}</figcaption>
                </figure>
              ))}
            </div>
          </Panel>
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
              title="Daily work and attendance"
              detail="Every marked day, 2P day and overtime amount."
            >
              <div className={`${styles["table-wrap"]}`}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
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

export function WorkersPage({ businessType = "LABOUR" }) {
  const navigate = useNavigate();
  const type = businessType;
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState();
  const [deleting, setDeleting] = useState();
  const [history, setHistory] = useState();
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
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
  const getExportWorkers = async () => {
    const result = await request(api.get("/workers", { params: { type } }));
    return result.workers || [];
  };
  const exportExcel = async () => {
    setExporting(true);
    setError("");
    try {
      const records = await getExportWorkers();
      const csv = [
        exportColumns.map(([label]) => csvCell(label)).join(","),
        ...records.map((worker) =>
          exportColumns
            .map(([, key]) => csvCell(exportValue(worker, key)))
            .join(","),
        ),
      ].join("\r\n");
      const blob = new Blob([`\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type.toLowerCase()}-workforce.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };
  const exportPdf = async () => {
    setExporting(true);
    setError("");
    try {
      printWorkers(await getExportWorkers(), type);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow={type === "PAINTER" ? "PAINTER TEAM" : "LABOUR TEAM"}
        title={
          type === "PAINTER"
            ? "Painter workforce management"
            : "Labour workforce management"
        }
        detail={
          type === "PAINTER"
            ? "Maintain complete painter profiles, daily rates and work history separately from labour."
            : "Maintain complete labour profiles, daily rates and work history separately from painters."
        }
        action={
          <div className={`${styles["actions-inline"]}`}>
            <Button
              icon={Download}
              className={`${styles["button-secondary"]}`}
              onClick={exportExcel}
              loading={exporting}
            >
              Excel
            </Button>
            <Button
              icon={Printer}
              className={`${styles["button-secondary"]}`}
              onClick={exportPdf}
              disabled={exporting}
            >
              PDF
            </Button>
            <AddButton
              className={`${styles["button-primary"]}`}
              onClick={() => setForm(true)}
            >
              Add {typeTitle(type)}
            </AddButton>
          </div>
        }
      />
      <Panel
        action={
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder={
              type === "LABOUR"
                ? "Search labour by name, team or work zone…"
                : "Search painter by name or work zone…"
            }
          />
        }
      >
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>{typeTitle(type)}</th>
                {type === "LABOUR" && <th>Team</th>}
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
                <tr
                  key={worker._id}
                  className={
                    worker.active
                      ? styles["worker-active"]
                      : styles["worker-inactive"]
                  }
                >
                  <td>
                    <strong>{worker.name}</strong>
                    <small>Joined {date(worker.joiningDate)}</small>
                  </td>
                  {type === "LABOUR" && <td>{worker.teamName || "—"}</td>}
                  <td>
                    {worker.photoPath ? (
                      <img
                        src={imageUrl(worker, "photoUrl", "photoPath")}
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
                  <td colSpan={type === "LABOUR" ? 12 : 11}>
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
