import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Copy,
  Lock,
  Save,
  XCircle,
} from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { ErrorNote, SectionTabs, errorMessage } from "./shared.jsx";
import {
  Empty,
  Field,
  PageHeader,
  Panel,
  SearchBox,
  Status,
} from "../components/ui/index.jsx";
import styles from "../styles/design.module.css";

const statusMeta = {
  NOT_MARKED: { tone: "neutral", label: "Not marked", Icon: CalendarDays },
  PRESENT: { tone: "teal", label: "Present", Icon: CheckCircle2 },
  DOUBLE_PRESENT: { tone: "purple", label: "2P / Double", Icon: CheckCircle2 },
  ABSENT: { tone: "coral", label: "Absent", Icon: XCircle },
  HALF_DAY: { tone: "amber", label: "Half day", Icon: Clock3 },
  LEAVE: { tone: "blue", label: "Leave", Icon: Coffee },
};

const defaultDate = () => new Date().toISOString().slice(0, 10);
const defaultMonth = () => defaultDate().slice(0, 7);
const monthlyStatusOrder = [
  "NOT_MARKED",
  "PRESENT",
  "ABSENT",
  "HALF_DAY",
  "LEAVE",
  "DOUBLE_PRESENT",
];

function MonthlyAttendance({ businessType, onBack }) {
  const [month, setMonth] = useState(defaultMonth());
  const [data, setData] = useState({ workers: [], days: 0, attendance: [] });
  const [cells, setCells] = useState({});
  const [periodWorker, setPeriodWorker] = useState("");
  const [periodStart, setPeriodStart] = useState(`${defaultMonth()}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${defaultMonth()}-01`);
  const [periodStatus, setPeriodStatus] = useState("PRESENT");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request(
        api.get("/attendance/monthly", {
          params: { month, type: businessType },
        }),
      );
      const nextCells = {};
      result.attendance.forEach((item) => {
        nextCells[`${item.worker}:${item.date}`] = item.status;
      });
      setData(result);
      setCells(nextCells);
      setPeriodWorker((current) => current || result.workers[0]?._id || "");
      setPeriodStart(`${month}-01`);
      setPeriodEnd(`${month}-${String(result.days).padStart(2, "0")}`);
      setSaved(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [month, businessType]);

  const statusFor = (workerId, day) =>
    cells[`${workerId}:${month}-${String(day).padStart(2, "0")}`] ||
    "NOT_MARKED";
  const cycleStatus = (workerId, day) => {
    if (data.locked) return;
    const dateKey = `${month}-${String(day).padStart(2, "0")}`;
    const key = `${workerId}:${dateKey}`;
    const current = cells[key] || "NOT_MARKED";
    const next =
      monthlyStatusOrder[
        (monthlyStatusOrder.indexOf(current) + 1) % monthlyStatusOrder.length
      ];
    setCells((currentCells) => ({ ...currentCells, [key]: next }));
    setSaved(false);
  };
  const applyPeriod = () => {
    if (data.locked || !periodWorker || !periodStart || !periodEnd) return;
    if (periodStart > periodEnd) {
      setError("Period start must be before or equal to period end.");
      return;
    }
    const nextCells = { ...cells };
    for (
      let current = periodStart;
      current <= periodEnd;
      current = `${current.slice(0, 8)}${String(Number(current.slice(8)) + 1).padStart(2, "0")}`
    ) {
      nextCells[`${periodWorker}:${current}`] = periodStatus;
    }
    setCells(nextCells);
    setError("");
    setSaved(false);
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const entries = data.workers.flatMap((worker) =>
        Array.from({ length: data.days }, (_, index) => {
          const day = index + 1;
          return {
            worker: worker._id,
            date: `${month}-${String(day).padStart(2, "0")}`,
            status: statusFor(worker._id, day),
          };
        }),
      );
      await request(api.post("/attendance/bulk", { month, entries }));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="ATTENDANCE"
        title="Monthly attendance"
        detail="Review and update a full month in one grid. Click a cell to cycle its status."
        action={
          <div className={`${styles["actions-inline"]}`}>
            <Field label="Month">
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </Field>
            <button
              className={`${styles["text-button"]}`}
              onClick={onBack}
              type="button"
            >
              Daily view
            </button>
          </div>
        }
      />
      <Panel
        title={`${businessType === "PAINTER" ? "Painter" : "Labour"} monthly grid`}
        detail={`${data.workers.length} active workers · ${data.locked ? "Locked" : "Open"}`}
        action={
          <button
            className={`${styles["button-primary"]}`}
            onClick={save}
            disabled={saving || loading || data.locked}
            type="button"
          >
            <Save size={15} /> {saving ? "Saving…" : "Save month"}
          </button>
        }
      >
        <div className={`${styles["toolbar"]}`}>
          <Field label="Labour">
            <select
              value={periodWorker}
              onChange={(event) => setPeriodWorker(event.target.value)}
              disabled={data.locked || loading}
            >
              {!data.workers.length && <option value="">No labour</option>}
              {data.workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input
              type="date"
              value={periodStart}
              min={`${month}-01`}
              max={`${month}-${String(data.days).padStart(2, "0")}`}
              onChange={(event) => setPeriodStart(event.target.value)}
              disabled={data.locked || loading}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={periodEnd}
              min={`${month}-01`}
              max={`${month}-${String(data.days).padStart(2, "0")}`}
              onChange={(event) => setPeriodEnd(event.target.value)}
              disabled={data.locked || loading}
            />
          </Field>
          <Field label="Mark as">
            <select
              value={periodStatus}
              onChange={(event) => setPeriodStatus(event.target.value)}
              disabled={data.locked || loading}
            >
              {Object.entries(statusMeta).map(([status, meta]) => (
                <option key={status} value={status}>
                  {meta.label}
                </option>
              ))}
            </select>
          </Field>
          <button
            className={`${styles["text-button"]}`}
            onClick={applyPeriod}
            disabled={data.locked || loading || !periodWorker}
            type="button"
          >
            Apply period
          </button>
        </div>
        <ErrorNote error={error} />
        {saved && <Status tone="teal">Month saved</Status>}
        {loading ? (
          <Empty title="Loading month…" />
        ) : (
          <div
            className={`${styles["table-wrap"]} ${styles["monthly-grid-wrap"]}`}
          >
            <table className={`${styles["monthly-grid"]}`}>
              <thead>
                <tr>
                  <th>Worker</th>
                  {Array.from({ length: data.days }, (_, index) => (
                    <th key={index + 1}>{index + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.workers.map((worker) => (
                  <tr key={worker._id}>
                    <td>
                      <strong>{worker.name}</strong>
                      <small>
                        {worker.type === "PAINTER" ? "Painter" : "Labour"}
                      </small>
                    </td>
                    {Array.from({ length: data.days }, (_, index) => {
                      const day = index + 1;
                      const status = statusFor(worker._id, day);
                      const meta = statusMeta[status];
                      return (
                        <td key={day}>
                          <button
                            type="button"
                            className={`${styles["monthly-cell"]} ${styles[`monthly-${status.toLowerCase()}`]}`}
                            onClick={() => cycleStatus(worker._id, day)}
                            disabled={data.locked}
                            title={`${worker.name}, ${month}-${String(day).padStart(2, "0")}: ${meta.label}`}
                          >
                            {status === "DOUBLE_PRESENT"
                              ? "2P"
                              : status === "NOT_MARKED"
                                ? "-"
                                : status.charAt(0)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.workers.length && <Empty title="No active workers" />}
          </div>
        )}
      </Panel>
    </>
  );
}

export function AttendancePage({ businessType = "LABOUR" }) {
  const navigate = useNavigate();
  const workerType = businessType;
  const [date, setDate] = useState(defaultDate());
  const [workers, setWorkers] = useState([]);
  const [summary, setSummary] = useState({
    NOT_MARKED: 0,
    DOUBLE_PRESENT: 0,
    PRESENT: 0,
    HALF_DAY: 0,
    ABSENT: 0,
    LEAVE: 0,
  });
  const [typeSummary, setTypeSummary] = useState({
    LABOUR: { total: 0, PRESENT: 0, payable: 0 },
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [locked, setLocked] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("daily");

  const load = async () => {
    try {
      const params = {
        date,
        ...(workerType !== "ALL" ? { type: workerType } : {}),
      };
      const attendanceData = await request(api.get("/attendance", { params }));
      const {
        workers: result,
        summary: nextSummary,
        typeSummary: nextTypeSummary,
        locked: nextLocked,
        canEdit: nextCanEdit,
      } = attendanceData;
      setWorkers(result || []);
      setTypeSummary(nextTypeSummary || { LABOUR: {} });
      setSummary(
        nextSummary || {
          NOT_MARKED: 0,
          DOUBLE_PRESENT: 0,
          PRESENT: 0,
          HALF_DAY: 0,
          ABSENT: 0,
          LEAVE: 0,
        },
      );
      setLocked(Boolean(nextLocked));
      setCanEdit(Boolean(nextCanEdit));
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  useEffect(() => {
    setError("");
    load();
  }, [workerType, date]);

  const filteredWorkers = useMemo(
    () =>
      workers.filter((worker) =>
        String(worker.name || "")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [workers, search],
  );

  const changeWorkforceTab = (nextTab) => {
    if (nextTab === "ATTENDANCE") return;
    navigate(`/${nextTab.toLowerCase()}/workers`);
  };

  const updateStatus = async (workerId, nextStatus) => {
    if (!canEdit || locked) return;
    setSaving(true);
    setError("");
    try {
      await request(
        api.put("/attendance", {
          worker: workerId,
          date,
          status: nextStatus,
        }),
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const updateDetails = async (worker, details) => {
    if (!canEdit || locked) return;
    setSaving(true);
    setError("");
    try {
      await request(
        api.put("/attendance", {
          worker: worker._id,
          date,
          status: worker.status,
          hours: Number(details.hours ?? worker.hours ?? 8),
          overtimeHours: Number(
            details.overtimeHours ?? worker.overtimeHours ?? 0,
          ),
          overtimeRate: Number(
            details.overtimeRate ??
              worker.overtimeRate ??
              worker.dailyRate ??
              0,
          ),
        }),
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const markAllPresent = async () => {
    if (!canEdit || locked) return;
    setSaving(true);
    setError("");
    try {
      await Promise.all(
        workers.map((worker) =>
          request(
            api.put("/attendance", {
              worker: worker._id,
              date,
              status: "PRESENT",
            }),
          ),
        ),
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const copyYesterday = async () => {
    if (!canEdit || locked) return;
    setSaving(true);
    setError("");
    try {
      await request(api.post("/attendance/copy-yesterday", { date }));
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleLock = async () => {
    if (!canEdit) return;
    setSaving(true);
    setError("");
    try {
      await request(api.patch("/attendance/lock", { date, locked: !locked }));
      setLocked((current) => !current);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (view === "monthly") {
    return (
      <MonthlyAttendance
        businessType={workerType}
        onBack={() => setView("daily")}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="ATTENDANCE"
        title="Daily labour attendance"
        detail="Mark every active labour worker once per day and keep payable amounts accurate."
      />

      <div className={`${styles["metric-grid"]} ${styles["compact-metrics"]}`}>
        {[["LABOUR", "Labour", "teal"]].map(([group, label, tone]) => (
          <div
            key={group}
            className={`${styles["metric"]} ${styles[`metric-${tone}`]}`}
          >
            <div className={`${styles["metric-top"]}`}>
              <span>{label}</span>
              <strong>{typeSummary[group]?.total || 0}</strong>
            </div>
            <small>Present: {typeSummary[group]?.PRESENT || 0}</small>
          </div>
        ))}
        {[
          ["PRESENT", "Present", "teal"],
          ["DOUBLE_PRESENT", "2P / Double", "purple"],
          ["HALF_DAY", "Half day", "amber"],
          ["ABSENT", "Absent", "coral"],
          ["LEAVE", "Leave", "blue"],
        ].map(([status, label, tone]) => (
          <div
            key={status}
            className={`${styles["metric"]} ${styles[`metric-${tone}`]}`}
          >
            <div className={`${styles["metric-top"]}`}>
              <span>{label}</span>
            </div>
            <strong>{summary[status] || 0}</strong>
          </div>
        ))}
      </div>

      <Panel
        title="Today's attendance"
        detail={`${workers.length} workers · ${locked ? "Locked" : "Open"}`}
        action={
          <div className={`${styles["actions-inline"]}`}>
            {!canEdit && <Status tone="neutral">Viewer</Status>}
            {canEdit && (
              <>
                <button
                  className={`${styles["text-button"]}`}
                  onClick={() => setView("monthly")}
                  type="button"
                >
                  Monthly view
                </button>
                <button
                  className={`${styles["text-button"]}`}
                  onClick={markAllPresent}
                  disabled={saving || locked}
                >
                  Mark all Present
                </button>
                <button
                  className={`${styles["text-button"]}`}
                  onClick={copyYesterday}
                  disabled={saving || locked}
                >
                  <Copy size={14} /> Yesterday copy
                </button>
                <button
                  className={`${styles["text-button"]}`}
                  onClick={toggleLock}
                  disabled={saving}
                >
                  <Lock size={14} /> {locked ? "Unlock" : "Lock"}
                </button>
              </>
            )}
          </div>
        }
      >
        <div className={`${styles["toolbar"]}`}>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search worker name…"
          />
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        </div>

        <ErrorNote error={error} />

        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Status</th>
                <th>Payable: base + OT</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((worker) => {
                const meta = statusMeta[worker.status] || statusMeta.NOT_MARKED;
                return (
                  <tr key={worker._id}>
                    <td className={`${styles["attendance-worker"]}`}>
                      <strong>{worker.name}</strong>
                      <small>
                        {worker.type === "PAINTER" ? "Painter" : "Labour"} ·{" "}
                        {worker.teamName ? `${worker.teamName} · ` : ""}
                        {worker.phone || "No phone"} ·{" "}
                        {worker.dailyRate
                          ? `₹${worker.dailyRate}/day`
                          : "No rate"}
                      </small>
                    </td>
                    <td>
                      <div className={`${styles["status-row"]}`}>
                        <Status tone={meta.tone}>{meta.label}</Status>
                        {canEdit && !locked && (
                          <div className={`${styles["segmented"]}`}>
                            {Object.entries(statusMeta).map(
                              ([statusValue, itemMeta]) => (
                                <button
                                  key={statusValue}
                                  type="button"
                                  className={
                                    worker.status === statusValue
                                      ? styles.active
                                      : ""
                                  }
                                  onClick={() =>
                                    updateStatus(worker._id, statusValue)
                                  }
                                  disabled={saving}
                                >
                                  <itemMeta.Icon size={12} />
                                  {itemMeta.label}
                                </button>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong>
                        ₹
                        {Number(worker.payableAmount || 0).toLocaleString(
                          "en-IN",
                        )}
                      </strong>
                      <small>
                        Base ₹
                        {(
                          Number(worker.dailyRate || 0) *
                          Number(worker.workUnits || 0)
                        ).toLocaleString("en-IN")}{" "}
                        + OT ₹
                        {(
                          Number(worker.overtimeHours || 0) *
                          Number(worker.overtimeRate || 0)
                        ).toLocaleString("en-IN")}
                      </small>
                      {canEdit && !locked && (
                        <div className={`${styles["status-row"]}`}>
                          <input
                            title="Overtime hours"
                            aria-label={`Overtime hours for ${worker.name}`}
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*[.]?[0-9]*"
                            value={worker.overtimeHours}
                            onChange={(event) =>
                              updateDetails(worker, {
                                overtimeHours: event.target.value,
                              })
                            }
                          />
                          <input
                            title="Overtime rate per hour"
                            aria-label={`Overtime rate for ${worker.name}`}
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*[.]?[0-9]*"
                            value={worker.overtimeRate}
                            onChange={(event) =>
                              updateDetails(worker, {
                                overtimeRate: event.target.value,
                              })
                            }
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!filteredWorkers.length && (
                <tr>
                  <td colSpan="3">
                    <Empty
                      title="No matching workers"
                      detail="Try a different name or worker group filter."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
