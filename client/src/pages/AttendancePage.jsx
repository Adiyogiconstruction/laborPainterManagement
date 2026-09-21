import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Copy,
  Lock,
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

export function AttendancePage() {
  const navigate = useNavigate();
  const [workerType, setWorkerType] = useState("ALL");
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
    PAINTER: { total: 0, PRESENT: 0, payable: 0 },
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [locked, setLocked] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [error, setError] = useState("");

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
      setTypeSummary(nextTypeSummary || { LABOUR: {}, PAINTER: {} });
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
    navigate(`/workers?type=${nextTab}`);
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

  return (
    <>
      <PageHeader
        eyebrow="ATTENDANCE"
        title="Daily workforce attendance"
        detail="Mark every active labour and painter once per day. Their category comes from the worker profile."
        action={
          <div className={`${styles["actions-inline"]}`}>
            <Field label="Worker group">
              <select
                value={workerType}
                onChange={(event) => setWorkerType(event.target.value)}
              >
                <option value="ALL">All workers</option>
                <option value="LABOUR">Labour only</option>
                <option value="PAINTER">Painters only</option>
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
          </div>
        }
      />

      <SectionTabs
        value="ATTENDANCE"
        showAttendance
        onChange={(nextTab) => {
          if (nextTab === "ATTENDANCE") return;
          changeWorkforceTab(nextTab);
        }}
      />

      <div className={`${styles["metric-grid"]} ${styles["compact-metrics"]}`}>
        {[
          ["LABOUR", "Labour", "teal"],
          ["PAINTER", "Painters", "blue"],
        ].map(([group, label, tone]) => (
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
