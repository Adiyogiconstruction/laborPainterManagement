import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Copy,
  Lock,
  Printer,
  Save,
  XCircle,
} from "lucide-react";
import api, { request } from "../services/apiClient.js";
import companyLogo from "../assets/image.png";
import { money } from "../utils/formatters.js";
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
const monthLabel = (monthValue) => {
  if (!monthValue) return "";
  const [year, month] = monthValue.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
};
function MonthlyAttendance({ businessType }) {
  const [month, setMonth] = useState(defaultMonth());
  const [data, setData] = useState({
    workers: [],
    days: 0,
    attendance: [],
    canEdit: false,
  });
  const [cells, setCells] = useState({});
  const [drafts, setDrafts] = useState({});
  const [periodWorker, setPeriodWorker] = useState("");
  const [periodTeam, setPeriodTeam] = useState("");
  const [periodCompany, setPeriodCompany] = useState("");
  const [periodStart, setPeriodStart] = useState(`${defaultMonth()}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${defaultMonth()}-01`);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attendancePrintMode, setAttendancePrintMode] = useState(false);
  const [error, setError] = useState("");
  const [companyProfile, setCompanyProfile] = useState(null);
  const containerRef = useRef(null);

  const handleGridKeyDown = (event) => {
    if (event.target.tagName !== "INPUT") return;

    const input = event.target;
    const { key, selectionStart, value } = input;
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);

    let nextRow = row;
    let nextCol = col;

    if (key === "ArrowRight" && selectionStart === value.length) {
      nextCol += 1;
    } else if (key === "ArrowLeft" && selectionStart === 0) {
      nextCol -= 1;
    } else if (key === "ArrowDown") {
      nextRow += 1;
    } else if (key === "ArrowUp") {
      nextRow -= 1;
    } else {
      return;
    }

    const nextInput = containerRef.current?.querySelector(
      `input[data-row="${nextRow}"][data-col="${nextCol}"]`,
    );

    if (nextInput) {
      event.preventDefault();
      nextInput.focus();
      nextInput.select();
    }
  };

  useEffect(() => {
    const handleAfterPrint = () => setAttendancePrintMode(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  useEffect(() => {
    request(api.get("/company-profile"))
      .then(({ profile }) => setCompanyProfile(profile || null))
      .catch(() => setCompanyProfile(null));
  }, []);

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
        nextCells[`${item.worker}:${item.date}`] = {
          status: item.status,
          overtimeHours: Number(item.overtimeHours || 0),
          payableAmount: Number(item.payableAmount || 0),
        };
      });
      setData(result);
      setCells(nextCells);
      setDrafts({});
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

  const teams = useMemo(
    () =>
      [
        ...new Set(
          data.workers.map((worker) => worker.teamName).filter(Boolean),
        ),
      ].sort(),
    [data.workers],
  );
  const companies = useMemo(
    () =>
      [
        ...new Set(
          data.workers.map((worker) => worker.companyName).filter(Boolean),
        ),
      ].sort(),
    [data.workers],
  );
  const workerMatches = (worker) =>
    (!periodWorker || worker._id === periodWorker) &&
    (!periodTeam || worker.teamName === periodTeam) &&
    (!periodCompany || worker.companyName === periodCompany);

  const cellFor = (workerId, day) =>
    cells[`${workerId}:${month}-${String(day).padStart(2, "0")}`] || {
      status: "NOT_MARKED",
      overtimeHours: 0,
    };
  const codeFor = (cell) => {
    if (cell.status === "PRESENT" && cell.overtimeHours > 0)
      return `P+${cell.overtimeHours}`;
    if (cell.status === "DOUBLE_PRESENT")
      return cell.overtimeHours > 0 ? `P+P+${cell.overtimeHours}` : "P+P";
    if (cell.status === "PRESENT") return "P";
    if (cell.status === "ABSENT") return "A";
    if (cell.status === "HALF_DAY") return "H";
    if (cell.status === "LEAVE") return "L";
    return "";
  };
  const totalDaysFor = (worker) => {
    let normalDays = 0;
    let overtimeHours = 0;
    for (let day = 1; day <= data.days; day += 1) {
      const dateKey = `${month}-${String(day).padStart(2, "0")}`;
      if (dateKey < periodStart || dateKey > periodEnd) continue;
      const cell = cellFor(worker._id, day);
      normalDays +=
        cell.status === "DOUBLE_PRESENT"
          ? 2
          : cell.status === "PRESENT"
            ? 1
            : cell.status === "HALF_DAY"
              ? 0.5
              : 0;
      overtimeHours += Number(cell.overtimeHours || 0);
    }
    return normalDays + overtimeHours / 8;
  };
  const parseCode = (value) => {
    const code = String(value || "")
      .trim()
      .toUpperCase()
      .replaceAll(" ", "");
    if (!code) return { status: "NOT_MARKED", overtimeHours: 0 };
    if (code === "P+P") return { status: "DOUBLE_PRESENT", overtimeHours: 0 };
    const doublePresentOvertime = code.match(/^P\+P\+(\d+(?:\.\d+)?)$/);
    if (doublePresentOvertime) {
      return {
        status: "DOUBLE_PRESENT",
        overtimeHours: Number(doublePresentOvertime[1]),
      };
    }
    if (code === "P") return { status: "PRESENT", overtimeHours: 0 };
    if (code === "A") return { status: "ABSENT", overtimeHours: 0 };
    if (code === "H") return { status: "HALF_DAY", overtimeHours: 0 };
    if (code === "L") return { status: "LEAVE", overtimeHours: 0 };
    const overtime = code.match(/^P\+(\d+(?:\.\d+)?)$/);
    if (overtime) {
      return { status: "PRESENT", overtimeHours: Number(overtime[1]) };
    }
    return null;
  };
  const payableFor = (worker, cell) => {
    const workUnits =
      cell.status === "DOUBLE_PRESENT"
        ? 2
        : cell.status === "PRESENT"
          ? 1
          : cell.status === "HALF_DAY"
            ? 0.5
            : 0;
    return (
      Number(worker.dailyRate || worker.defaultDailyRate || 0) * workUnits +
      Number(cell.overtimeHours || 0) * Number(worker.overtimeHourlyRate || 0)
    );
  };
  const updateCell = (workerId, day, value) => {
    if (data.locked || !data.canEdit) return;
    const dateKey = `${month}-${String(day).padStart(2, "0")}`;
    const key = `${workerId}:${dateKey}`;
    const uppercaseValue = String(value).toUpperCase();
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [key]: uppercaseValue,
    }));
    const next = parseCode(uppercaseValue);
    if (!next) return;
    const worker = data.workers.find((item) => item._id === workerId);
    setCells((currentCells) => ({
      ...currentCells,
      [key]: {
        ...next,
        payableAmount: worker ? payableFor(worker, next) : 0,
      },
    }));
    setSaved(false);
  };
  const commitCell = (workerId, day) => {
    const dateKey = `${month}-${String(day).padStart(2, "0")}`;
    const key = `${workerId}:${dateKey}`;
    const next = parseCode(drafts[key]);
    if (!next) {
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [key]: codeFor(cellFor(workerId, day)),
      }));
    }
  };
  const statusFor = (workerId, day) => cellFor(workerId, day).status;
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
            status: cellFor(worker._id, day).status,
            overtimeHours: cellFor(worker._id, day).overtimeHours,
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
  const toggleMonthLock = async () => {
    if (!data.canEdit) return;
    setSaving(true);
    setError("");
    try {
      const result = await request(
        api.patch("/attendance/lock-month", {
          month,
          locked: !data.locked,
        }),
      );
      setData((current) => ({ ...current, locked: result.locked }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const printAttendanceReport = () => {
    setAttendancePrintMode(true);
    window.setTimeout(() => window.print(), 0);
  };

  return (
    <div className={attendancePrintMode ? "attendance-pdf-root" : undefined}>
      <PageHeader
        eyebrow="ATTENDANCE"
        title="Monthly attendance"
        detail="Enter P, A, P+P, P+P+1, L, H or P+1 directly in each day cell."
      />
      <Panel
        title={`${businessType === "PAINTER" ? "Painter" : "Labour"} monthly grid`}
        detail={`${data.workers.length} active workers · ${data.locked ? "Locked" : "Open"}`}
        action={
          <div className={`${styles["actions-inline"]}`}>
            <button
              className={`${styles["button-secondary"]}`}
              onClick={printAttendanceReport}
              disabled={loading || !data.workers.filter(workerMatches).length}
              type="button"
            >
              <Printer size={15} /> Attendance PDF
            </button>
            <button
              className={`${styles["button-primary"]}`}
              onClick={save}
              disabled={saving || loading || data.locked || !data.canEdit}
              type="button"
            >
              <Save size={15} /> {saving ? "Saving…" : "Save month"}
            </button>
            {data.canEdit && (
              <button
                className={`${styles["button-secondary"]}`}
                onClick={toggleMonthLock}
                disabled={saving || loading}
                type="button"
              >
                <Lock size={15} /> {data.locked ? "Unlock month" : "Lock month"}
              </button>
            )}
          </div>
        }
      >
        <div className={`${styles["toolbar"]}`}>
          <Field label="Month">
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </Field>
          <Field label="Worker filter">
            <select
              value={periodWorker}
              onChange={(event) => setPeriodWorker(event.target.value)}
            >
              <option value="">All labour</option>
              {data.workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Team filter">
            <select
              value={periodTeam}
              onChange={(event) => setPeriodTeam(event.target.value)}
            >
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Company filter">
            <select
              value={periodCompany}
              onChange={(event) => setPeriodCompany(event.target.value)}
            >
              <option value="">All companies</option>
              {companies.map((company) => (
                <option key={company} value={company}>
                  {company}
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
        </div>
        <div
          className={`${styles["metric-grid"]} ${styles["compact-metrics"]}`}
        >
          {[
            ["PRESENT", "Total present", "teal"],
            ["DOUBLE_PRESENT", "Total double present", "purple"],
            ["ABSENT", "Total absent", "coral"],
            ["HALF_DAY", "Total half day", "amber"],
            ["LEAVE", "Total leave", "blue"],
          ].map(([status, label, tone]) => {
            const count = data.workers.reduce((total, worker) => {
              if (!workerMatches(worker)) return total;
              for (let day = 1; day <= data.days; day += 1) {
                const dateKey = `${month}-${String(day).padStart(2, "0")}`;
                if (
                  dateKey >= periodStart &&
                  dateKey <= periodEnd &&
                  statusFor(worker._id, day) === status
                ) {
                  total += 1;
                }
              }
              return total;
            }, 0);
            return (
              <div
                key={status}
                className={`${styles["metric"]} ${styles[`metric-${tone}`]}`}
              >
                <div className={`${styles["metric-top"]}`}>
                  <span>{label}</span>
                </div>
                <strong>{count}</strong>
              </div>
            );
          })}
          <div className={`${styles["metric"]} ${styles["metric-amber"]}`}>
            <div className={`${styles["metric-top"]}`}>
              <span>Total OT hours</span>
            </div>
            <strong>
              {data.workers.reduce((total, worker) => {
                if (!workerMatches(worker)) return total;
                for (let day = 1; day <= data.days; day += 1) {
                  const dateKey = `${month}-${String(day).padStart(2, "0")}`;
                  if (dateKey >= periodStart && dateKey <= periodEnd) {
                    total += Number(
                      cellFor(worker._id, day).overtimeHours || 0,
                    );
                  }
                }
                return total;
              }, 0)}
            </strong>
          </div>
          <div className={`${styles["metric"]} ${styles["metric-teal"]}`}>
            <div className={`${styles["metric-top"]}`}>
              <span>Total payable</span>
            </div>
            <strong>
              {money(
                data.workers.reduce((total, worker) => {
                  if (!workerMatches(worker)) return total;
                  for (let day = 1; day <= data.days; day += 1) {
                    const dateKey = `${month}-${String(day).padStart(2, "0")}`;
                    if (dateKey >= periodStart && dateKey <= periodEnd) {
                      total += Number(
                        cellFor(worker._id, day).payableAmount ||
                          payableFor(worker, cellFor(worker._id, day)),
                      );
                    }
                  }
                  return total;
                }, 0),
              )}
            </strong>
          </div>
        </div>
        <p className={`${styles["form-hint"]}`}>
          Codes: P = present, A = absent, P+P = double present, P+P+1 = double
          present with one OT hour, L = leave, H = half day, P+1 = present with
          one OT hour.
        </p>
        <ErrorNote error={error} />
        {saved && <Status tone="teal">Month saved</Status>}
        {loading ? (
          <Empty title="Loading month…" />
        ) : (
          <div
            ref={containerRef}
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
                {data.workers.filter(workerMatches).map((worker) => (
                  <tr key={worker._id}>
                    <td>
                      <strong>{worker.name}</strong>
                      <small>
                        {worker.type === "PAINTER" ? "Painter" : "Labour"}
                      </small>
                    </td>
                    {Array.from({ length: data.days }, (_, index) => {
                      const day = index + 1;
                      const cell = cellFor(worker._id, day);
                      const status = cell.status;
                      const meta = statusMeta[status];
                      return (
                        <td key={day}>
                          <input
                            type="text"
                            maxLength="6"
                            value={
                              drafts[
                                `${worker._id}:${month}-${String(day).padStart(2, "0")}`
                              ] ?? codeFor(cell)
                            }
                            data-row={index}
                            data-col={day - 1}
                            className={`${styles["monthly-cell"]} ${styles[`monthly-${status.toLowerCase()}`]}`}
                            onChange={(event) =>
                              updateCell(worker._id, day, event.target.value)
                            }
                            onKeyDown={handleGridKeyDown}
                            onBlur={() => commitCell(worker._id, day)}
                            disabled={data.locked || !data.canEdit}
                            aria-label={`${worker.name}, ${month}-${String(day).padStart(2, "0")}`}
                            title={`${worker.name}, ${month}-${String(day).padStart(2, "0")}: ${meta.label}`}
                          />
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
      {attendancePrintMode && (
        <Panel
          title="Attendance PDF"
          detail={`${month} · ${data.workers.filter(workerMatches).length} workers`}
          className="attendance-pdf-panel"
        >
          <div className="attendance-pdf-header">
            <div className="attendance-pdf-brand">
              <img
                src={companyProfile?.logoUrl || companyLogo}
                alt={companyProfile?.companyName || "Company logo"}
              />
              <div>
                <h2>{companyProfile?.companyName || "Company Name"}</h2>
                <p>{companyProfile?.address || "Address"}</p>
                <p>
                  {companyProfile?.mobile || ""}
                  {companyProfile?.mobile && companyProfile?.email ? " | " : ""}
                  {companyProfile?.email || ""}
                </p>
              </div>
            </div>
            <div className="attendance-pdf-month">{monthLabel(month)}</div>
          </div>
          <div className={`${styles["table-wrap"]}`}>
            <table className={`${styles["attendance-pdf-table"]}`}>
              <thead>
                <tr>
                  <th>SR.NO</th>
                  <th>WORKERS NAME</th>
                  <th>COMPANY</th>
                  <th>LOCATION</th>
                  {Array.from({ length: data.days }, (_, index) => (
                    <th key={index + 1}>{index + 1}</th>
                  ))}
                  <th>
                    TOTAL
                    <br />
                    (D + H)
                  </th>
                  <th>
                    TOTAL
                    <br />
                    DAYS
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.workers.filter(workerMatches).map((worker, index) => {
                  let normalDays = 0;
                  let overtimeHours = 0;
                  const dayCodes = Array.from(
                    { length: data.days },
                    (_, dayIndex) => {
                      const day = dayIndex + 1;
                      const cell = cellFor(worker._id, day);
                      const dateKey = `${month}-${String(day).padStart(2, "0")}`;
                      const inRange =
                        dateKey >= periodStart && dateKey <= periodEnd;
                      if (inRange) {
                        normalDays +=
                          cell.status === "DOUBLE_PRESENT"
                            ? 2
                            : cell.status === "PRESENT"
                              ? 1
                              : cell.status === "HALF_DAY"
                                ? 0.5
                                : 0;
                        overtimeHours += Number(cell.overtimeHours || 0);
                      }
                      return codeFor(cell);
                    },
                  );
                  const totalDays = totalDaysFor(worker);
                  const displayNumber = (value) =>
                    Number(value.toFixed(2)).toString();
                  return (
                    <tr key={worker._id}>
                      <td>{index + 1}</td>
                      <td>{worker.name}</td>
                      <td>{worker.companyName || "-"}</td>
                      <td>{worker.workZone || "-"}</td>
                      {dayCodes.map((code, dayIndex) => {
                        const day = dayIndex + 1;
                        const inRange =
                          day >= Number(periodStart.slice(-2)) &&
                          day <= Number(periodEnd.slice(-2));
                        return <td key={day}>{inRange ? code : ""}</td>;
                      })}
                      <td>
                        {displayNumber(normalDays)} +{" "}
                        {displayNumber(overtimeHours)} OT hrs
                      </td>
                      <td>{displayNumber(totalDays)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={data.days + 5}>
                    <strong>AGGREGATE TOTAL DAYS</strong>
                  </td>
                  <td>
                    {data.workers
                      .filter(workerMatches)
                      .reduce(
                        (total, worker) => total + totalDaysFor(worker),
                        0,
                      )
                      .toFixed(2)
                      .replace(/\.00$/, "")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
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
  const [companyProfile, setCompanyProfile] = useState(null);
  const [view] = useState("monthly");

  const shiftDateBy = (offset) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setDate(next.toISOString().slice(0, 10));
  };

  const handleDateKeyDown = (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      shiftDateBy(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      shiftDateBy(-1);
    }
  };

  const handleAttendanceControlKeyDown = (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      handleDateKeyDown(event);
    }
  };

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
    return <MonthlyAttendance businessType={workerType} />;
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
              onKeyDown={handleAttendanceControlKeyDown}
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
                                  onKeyDown={handleAttendanceControlKeyDown}
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
                            onKeyDown={handleAttendanceControlKeyDown}
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
                            onKeyDown={handleAttendanceControlKeyDown}
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
