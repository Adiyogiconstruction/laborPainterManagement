import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Copy,
  FileDown,
  Lock,
  RefreshCw,
  Save,
  XCircle,
} from "lucide-react";
import api, { request } from "../services/apiClient.js";
import companyLogo from "../assets/image.png";
import { money } from "../utils/formatters.js";
import { ErrorNote, errorMessage } from "./shared.jsx";
import {
  Empty,
  Field,
  PageHeader,
  Panel,
  SearchBox,
  Status,
} from "../components/ui/index.jsx";
import styles from "../styles/design.module.css";
import { buildDirtyAttendanceEntries } from "../utils/attendanceChanges.js";
import { fetchAllPages } from "../utils/fetchAllPages.js";
import { subscribeToPaymentChanges } from "../utils/paymentEvents.js";
import {
  calculateAttendanceBalance,
  sumNetPaymentsForWorkers,
} from "../utils/attendancePaymentSummary.js";

const statusMeta = {
  NOT_MARKED: { tone: "neutral", label: "Not marked", Icon: CalendarDays },
  PRESENT: { tone: "teal", label: "Present", Icon: CheckCircle2 },
  DOUBLE_PRESENT: { tone: "purple", label: "2P / Double", Icon: CheckCircle2 },
  TRIPLE_PRESENT: { tone: "purple", label: "3P / Triple", Icon: CheckCircle2 },
  ABSENT: { tone: "coral", label: "Absent", Icon: XCircle },
  HALF_DAY: { tone: "amber", label: "Half day", Icon: Clock3 },
  LEAVE: { tone: "blue", label: "Leave", Icon: Coffee },
};

const defaultDate = () => new Date().toISOString().slice(0, 10);
const defaultMonth = () => defaultDate().slice(0, 7);
function MonthlyAttendance() {
  const businessType = "LABOUR";
  const [month, setMonth] = useState(defaultMonth());
  const [data, setData] = useState({
    workers: [],
    days: 0,
    attendance: [],
    canEdit: false,
  });
  const [periodPayments, setPeriodPayments] = useState([]);
  const [paymentsRefresh, setPaymentsRefresh] = useState(0);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [cells, setCells] = useState({});
  const [drafts, setDrafts] = useState({});
  const [workerSearch, setWorkerSearch] = useState("");
  const [workerStatus, setWorkerStatus] = useState("ACTIVE");
  const [periodWorker, setPeriodWorker] = useState("");
  const [periodTeam, setPeriodTeam] = useState("");
  const [periodCompany, setPeriodCompany] = useState("");
  const [periodZone, setPeriodZone] = useState("");
  const [workerPage, setWorkerPage] = useState(1);
  const [workerPageSize, setWorkerPageSize] = useState(20);
  const [periodStart, setPeriodStart] = useState(`${defaultMonth()}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${defaultMonth()}-01`);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState("");
  const [companyProfile, setCompanyProfile] = useState(null);
  const containerRef = useRef(null);
  const originalCellsRef = useRef({});

  useEffect(() => {
    request(api.get("/company-profile"))
      .then(({ profile }) => setCompanyProfile(profile || null))
      .catch((err) =>
        console.warn(
          "Company profile unavailable for attendance PDF branding:",
          err,
        ),
      );
  }, []);

  const handleGridKeyDown = (event) => {
    if (event.target.tagName !== "INPUT") return;

    const input = event.target;
    const { key } = event;
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);

    if (key === "Backspace" || key === "Delete") {
      event.preventDefault();
      const currentValue = String(input.value || "");
      const nextValue = currentValue.slice(0, -1);
      updateCell(input.dataset.worker, col + 1, nextValue);
      return;
    }

    let nextRow = row;
    let nextCol = col;

    if (key === "ArrowRight") {
      nextCol += 1;
    } else if (key === "ArrowLeft") {
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
          dailyRate:
            item.dailyRate == null ? undefined : Number(item.dailyRate),
          overtimeRate:
            item.overtimeRate == null ? undefined : Number(item.overtimeRate),
          payableAmount: Number(item.payableAmount || 0),
        };
      });
      setData(result);
      setCells(nextCells);
      originalCellsRef.current = nextCells;
      setDrafts({});
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

  useEffect(() => {
    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      setPeriodPayments([]);
      setPaymentsLoading(false);
      setPaymentsError("Choose a valid attendance date range.");
      return undefined;
    }

    let active = true;
    setPaymentsLoading(true);
    setPaymentsError("");
    fetchAllPages(async (skip, limit) => {
      const result = await request(
        api.get("/payments", {
          params: {
            type: businessType,
            from: periodStart,
            to: periodEnd,
            limit,
            skip,
          },
        }),
      );
      return { items: result.payments, total: result.total };
    })
      .then((payments) => {
        if (active) setPeriodPayments(payments);
      })
      .catch((err) => {
        if (active) {
          setPeriodPayments([]);
          setPaymentsError(errorMessage(err));
        }
      })
      .finally(() => {
        if (active) setPaymentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [periodStart, periodEnd, businessType, paymentsRefresh]);

  useEffect(
    () =>
      subscribeToPaymentChanges(() => {
        setPaymentsRefresh((current) => current + 1);
      }),
    [],
  );

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        setPaymentsRefresh((current) => current + 1);
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    return () => window.removeEventListener("focus", refreshWhenVisible);
  }, []);

  useEffect(() => {
    setWorkerPage(1);
  }, [
    month,
    workerSearch,
    workerStatus,
    periodWorker,
    periodTeam,
    periodCompany,
    periodZone,
  ]);

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
  const zones = useMemo(
    () =>
      [
        ...new Set(
          data.workers
            .map((worker) => worker.workZone?.trim())
            .filter(Boolean),
        ),
      ].sort(),
    [data.workers],
  );
  const workerMatches = (worker) =>
    (workerStatus === "ALL" ||
      (worker.labourStatus || (worker.active ? "ACTIVE" : "INACTIVE")) ===
        workerStatus) &&
    [worker.name, worker.phone].some((value) =>
      String(value || "")
        .toLocaleLowerCase()
        .includes(workerSearch.trim().toLocaleLowerCase()),
    ) &&
    (!periodWorker || worker._id === periodWorker) &&
    (!periodTeam || worker.teamName === periodTeam) &&
    (!periodCompany || worker.companyName === periodCompany) &&
    (!periodZone || worker.workZone?.trim() === periodZone);
  const filteredWorkers = data.workers.filter(workerMatches);
  const workerPageCount = Math.max(
    1,
    Math.ceil(filteredWorkers.length / workerPageSize),
  );
  const currentWorkerPage = Math.min(workerPage, workerPageCount);
  const pagedWorkers = filteredWorkers.slice(
    (currentWorkerPage - 1) * workerPageSize,
    currentWorkerPage * workerPageSize,
  );

  const cellFor = (workerId, day) =>
    cells[`${workerId}:${month}-${String(day).padStart(2, "0")}`] || {
      status: "NOT_MARKED",
      overtimeHours: 0,
    };
  const codeFor = (cell) => {
    if (cell.status === "PRESENT" && cell.overtimeHours > 0)
      return `P+${cell.overtimeHours}`;
    if (cell.status === "TRIPLE_PRESENT")
      return cell.overtimeHours > 0
        ? `P+P+P+${cell.overtimeHours}`
        : "P+P+P";
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
        cell.status === "TRIPLE_PRESENT"
          ? 3
          : cell.status === "DOUBLE_PRESENT"
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
    if (code === "P") return { status: "PRESENT", overtimeHours: 0 };
    if (code === "A") return { status: "ABSENT", overtimeHours: 0 };
    if (code === "H") return { status: "HALF_DAY", overtimeHours: 0 };
    if (code === "L") return { status: "LEAVE", overtimeHours: 0 };

    const repeatedPresent = code.match(
      /^(P(?:\+P)+)(?:\+(\d+(?:\.\d+)?))?$/,
    );
    if (repeatedPresent) {
      return {
        status:
          repeatedPresent[1].split("+").length === 3
            ? "TRIPLE_PRESENT"
            : "DOUBLE_PRESENT",
        overtimeHours: Number(repeatedPresent[2] || 0),
      };
    }

    const presentWithOvertime = code.match(/^P\+(\d+(?:\.\d+)?)$/);
    if (presentWithOvertime) {
      return {
        status: "PRESENT",
        overtimeHours: Number(presentWithOvertime[1]),
      };
    }

    return null;
  };
  const payableFor = (worker, cell, dateKey) => {
    const workUnits =
      cell.status === "TRIPLE_PRESENT"
        ? 3
        : cell.status === "DOUBLE_PRESENT"
          ? 2
        : cell.status === "PRESENT"
          ? 1
          : cell.status === "HALF_DAY"
            ? 0.5
            : 0;
    let effectiveRate;
    for (const rate of worker.rateHistory || []) {
      if (rate.applicableFrom > dateKey) break;
      effectiveRate = rate;
    }
    return (
      Number(
        cell.dailyRate ??
          effectiveRate?.dailyRate ??
          worker.dailyRate ??
          worker.defaultDailyRate ??
          0,
      ) *
        workUnits +
      Number(cell.overtimeHours || 0) *
        Number(
          cell.overtimeRate ??
            effectiveRate?.overtimeRate ??
            worker.overtimeHourlyRate ??
            0,
        )
    );
  };
  const selectedPeriodPayable = filteredWorkers.reduce((total, worker) => {
    for (let day = 1; day <= data.days; day += 1) {
      const dateKey = `${month}-${String(day).padStart(2, "0")}`;
      if (dateKey < periodStart || dateKey > periodEnd) continue;
      const cell = cellFor(worker._id, day);
      total += Number(
        cell.payableAmount ??
          payableFor(worker, cell, dateKey),
      );
    }
    return total;
  }, 0);
  const filteredWorkerIds = new Set(filteredWorkers.map((worker) => worker._id));
  const selectedPeriodPaid = sumNetPaymentsForWorkers(
    periodPayments,
    filteredWorkerIds,
  );
  const selectedPeriodBalance = calculateAttendanceBalance(
    selectedPeriodPayable,
    selectedPeriodPaid,
  );
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
    const existingCell = cellFor(workerId, day);
    setCells((currentCells) => ({
      ...currentCells,
      [key]: {
        ...next,
        payableAmount: worker
          ? payableFor(
              worker,
              {
                ...next,
                dailyRate: existingCell.dailyRate,
                overtimeRate: existingCell.overtimeRate,
              },
              dateKey,
            )
          : 0,
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
  const dirtyEntries = () =>
    buildDirtyAttendanceEntries({
      workers: data.workers,
      days: data.days,
      month,
      cells,
      originalCells: originalCellsRef.current,
    });
  const refreshAttendance = async () => {
    if (
      dirtyEntries().length &&
      !window.confirm("Refresh attendance and discard unsaved changes?")
    ) {
      return;
    }
    await load();
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const cellsAtSave = cells;
      const entries = dirtyEntries();
      if (entries.length) {
        await request(api.post("/attendance/bulk", { month, entries }));
        const nextOriginalCells = { ...originalCellsRef.current };
        for (const entry of entries) {
          const key = `${entry.worker}:${entry.date}`;
          const savedCell = cellsAtSave[key] || {
            status: "NOT_MARKED",
            overtimeHours: 0,
          };
          if (
            savedCell.status === "NOT_MARKED" &&
            Number(savedCell.overtimeHours || 0) === 0
          ) {
            delete nextOriginalCells[key];
          } else {
            nextOriginalCells[key] = savedCell;
          }
        }
        originalCellsRef.current = nextOriginalCells;
      }
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

  const downloadAttendancePdf = async () => {
    setGeneratingPdf(true);
    setError("");
    try {
      const selectedWorkers = data.workers.filter(workerMatches);
      const pdfWorkers = selectedWorkers.map((worker, index) => {
        let normalDays = 0;
        let overtimeHours = 0;
        const attendance = Array.from({ length: data.days }, (_, dayIndex) => {
          const day = dayIndex + 1;
          const dateKey = `${month}-${String(day).padStart(2, "0")}`;
          if (dateKey < periodStart || dateKey > periodEnd) return "";
          const cell = cellFor(worker._id, day);
          normalDays +=
            cell.status === "TRIPLE_PRESENT"
              ? 3
              : cell.status === "DOUBLE_PRESENT"
                ? 2
              : cell.status === "PRESENT"
                ? 1
                : cell.status === "HALF_DAY"
                  ? 0.5
                  : 0;
          overtimeHours += Number(cell.overtimeHours || 0);
          return codeFor(cell);
        });
        const totalDays = normalDays + overtimeHours / 8;
        return {
          serialNumber: index + 1,
          workerName: worker.name,
          company: worker.companyName,
          location: worker.workZone,
          attendance,
          totalDH: `${Number(normalDays.toFixed(3))} + ${Number(overtimeHours.toFixed(3))}`,
          totalDays: totalDays.toFixed(3),
          totalDaysValue: totalDays,
        };
      });
      const { generateAttendancePdf } = await import(
        "../utils/attendancePdf.js"
      );
      await generateAttendancePdf({
        month,
        team: periodTeam,
        companyName: periodCompany || "NA",
        workers: pdfWorkers,
        profileLogoUrl: companyProfile?.logoUrl,
        fallbackLogoUrl: companyLogo,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <>
      <PageHeader
        className={`${styles["attendance-page-header"]}`}
        title="Monthly attendance"
      />
      <Panel
        className={`${styles["attendance-month-panel"]}`}
        title="Labour monthly grid"
        detail={`${filteredWorkers.length} matching workers · ${data.locked ? "Locked" : "Open"}`}
        action={
          <div className={`${styles["actions-inline"]}`}>
            <button
              className={`${styles["button-secondary"]}`}
              onClick={refreshAttendance}
              disabled={saving || loading}
              type="button"
            >
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              className={`${styles["button-secondary"]}`}
              onClick={downloadAttendancePdf}
              disabled={
                generatingPdf || loading || !data.workers.filter(workerMatches).length
              }
              type="button"
            >
              <FileDown size={15} />{" "}
              {generatingPdf ? "Generating PDF…" : "Generate PDF"}
            </button>
            <button
              className={`${styles["button-primary"]}`}
              onClick={save}
              disabled={
                saving ||
                loading ||
                data.locked ||
                !data.canEdit ||
                dirtyEntries().length === 0
              }
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
          <SearchBox
            value={workerSearch}
            onChange={setWorkerSearch}
            placeholder="Search name or mobile number"
          />
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
              onChange={(event) => {
                const selectedWorker = data.workers.find(
                  (worker) => worker._id === event.target.value,
                );
                if (selectedWorker) {
                  setWorkerStatus(
                    selectedWorker.labourStatus ||
                      (selectedWorker.active ? "ACTIVE" : "INACTIVE"),
                  );
                }
                setPeriodWorker(event.target.value);
              }}
            >
              <option value="">All labour</option>
              {data.workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Worker status">
            <select
              value={workerStatus}
              onChange={(event) => {
                setWorkerStatus(event.target.value);
                setPeriodWorker("");
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="WENT_HOME">Went Home</option>
              <option value="ALL">All statuses</option>
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
          <Field label="Zone filter">
            <select
              value={periodZone}
              onChange={(event) => setPeriodZone(event.target.value)}
            >
              <option value="">All zones</option>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
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
            ["TRIPLE_PRESENT", "Total triple present", "purple"],
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
            <strong>{money(selectedPeriodPayable)}</strong>
          </div>
          <div className={`${styles["metric"]} ${styles["metric-teal"]}`}>
            <div className={`${styles["metric-top"]}`}>
              <span>Already paid</span>
            </div>
            <strong>
              {paymentsLoading
                ? "Loading…"
                : paymentsError
                  ? "Unavailable"
                  : money(selectedPeriodPaid)}
            </strong>
            <small>
              {paymentsError
                ? "Unable to load payments for this period."
                : `Net payments from ${periodStart} to ${periodEnd} for filtered labour`}
            </small>
          </div>
          <div className={`${styles["metric"]} ${styles["metric-coral"]}`}>
            <div className={`${styles["metric-top"]}`}>
              <span>Balance</span>
            </div>
            <strong>
              {paymentsLoading
                ? "Calculating…"
                : paymentsError
                  ? "Unavailable"
                  : money(selectedPeriodBalance)}
            </strong>
            <small>
              {paymentsError
                ? "Balance = total payable − already paid"
                : paymentsLoading
                  ? "Balance = total payable − already paid"
                  : `${money(selectedPeriodPayable)} − ${money(selectedPeriodPaid)} = ${money(selectedPeriodBalance)}`}
            </small>
          </div>
        </div>
        <ErrorNote error={error || paymentsError} />
        {saved && <Status tone="teal">Month saved</Status>}
        {loading ? (
          <Empty title="Loading month…" />
        ) : (
          <div
            ref={containerRef}
            className={`${styles["table-wrap"]} ${styles["monthly-grid-wrap"]}`}
          >
            {filteredWorkers.length > 0 && (
              <div className={`${styles["workforce-pagination"]} ${styles["attendance-pagination"]}`}>
                <label>
                  Rows
                  <select
                    value={workerPageSize}
                    onChange={(event) => {
                      setWorkerPageSize(Number(event.target.value));
                      setWorkerPage(1);
                    }}
                    aria-label="Attendance workers per page"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  per page
                </label>
                <span>
                  {(currentWorkerPage - 1) * workerPageSize + 1}–
                  {Math.min(currentWorkerPage * workerPageSize, filteredWorkers.length)} of{" "}
                  {filteredWorkers.length} workers
                </span>
                <div>
                  <button
                    type="button"
                    className={`${styles["button-secondary"]}`}
                    disabled={currentWorkerPage <= 1}
                    onClick={() => setWorkerPage(currentWorkerPage - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className={`${styles["button-secondary"]}`}
                    disabled={currentWorkerPage >= workerPageCount}
                    onClick={() => setWorkerPage(currentWorkerPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
                {pagedWorkers.map((worker, workerIndex) => (
                  <tr key={worker._id}>
                    <td>
                      <strong>{worker.name}</strong>
                      <small>
                        {worker.labourStatus === "WENT_HOME"
                          ? "Went Home"
                          : "Labour"}
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
                            maxLength="20"
                            value={
                              drafts[
                                `${worker._id}:${month}-${String(day).padStart(2, "0")}`
                              ] ?? codeFor(cell)
                            }
                            data-row={workerIndex}
                            data-col={day - 1}
                            data-worker={worker._id}
                            className={`${styles["monthly-cell"]} ${styles[`monthly-${status.toLowerCase()}`]} ${worker.labourStatus === "WENT_HOME" ? styles["monthly-went-home"] : ""}`}
                            onChange={(event) =>
                              updateCell(worker._id, day, event.target.value)
                            }
                            onKeyDown={handleGridKeyDown}
                            onBlur={() => commitCell(worker._id, day)}
                            disabled={
                              data.locked ||
                              !data.canEdit ||
                              worker.labourStatus === "WENT_HOME"
                            }
                            aria-label={`${worker.name}, ${month}-${String(day).padStart(2, "0")}${worker.labourStatus === "WENT_HOME" ? ", attendance disabled because labour went home" : ""}`}
                            title={
                              worker.labourStatus === "WENT_HOME"
                                ? `${worker.name}: attendance disabled because labour is marked Went Home`
                                : `${worker.name}, ${month}-${String(day).padStart(2, "0")}: ${meta.label}`
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredWorkers.length && (
              <Empty
                title={
                  data.workers.length
                    ? "No workers match these filters"
                    : "No workers found"
                }
              />
            )}
          </div>
        )}
      </Panel>
    </>
  );
}

export function AttendancePage() {
  const [date, setDate] = useState(defaultDate());
  const [workers, setWorkers] = useState([]);
  const [summary, setSummary] = useState({
    NOT_MARKED: 0,
    DOUBLE_PRESENT: 0,
    TRIPLE_PRESENT: 0,
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
      const params = { date, type: "LABOUR" };
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
          TRIPLE_PRESENT: 0,
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
  }, [date]);

  const filteredWorkers = useMemo(
    () =>
      workers.filter((worker) =>
        String(worker.name || "")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [workers, search],
  );

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
    return <MonthlyAttendance />;
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
          ["TRIPLE_PRESENT", "3P / Triple", "purple"],
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
                        Labour ·{" "}
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
