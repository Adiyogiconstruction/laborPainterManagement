import styles from "../styles/design.module.css";
import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  ChevronDown,
  ChevronUp,
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
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { subscribeToPaymentChanges } from "../utils/paymentEvents.js";
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
  errorMessage,
  typeTitle,
} from "./shared.jsx";

const localDateInput = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const currentMonthStart = () => {
  const now = new Date();
  return localDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
};

function ReportPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  if (!total) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const first = (currentPage - 1) * pageSize + 1;
  const last = Math.min(currentPage * pageSize, total);
  return (
    <div className={styles["workforce-pagination"]}>
      <label>
        Show
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          aria-label="Report rows per page"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
        rows
      </label>
      <span>
        Showing {first}–{last} of {total}
      </span>
      <div>
        <button
          type="button"
          className={styles["button-secondary"]}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className={styles["button-secondary"]}
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const type = "LABOUR";
  const [from, setFrom] = useState(currentMonthStart);
  const [to, setTo] = useState(() => localDateInput(new Date()));
  const [data, setData] = useState();
  const [attendanceData, setAttendanceData] = useState();
  const [attendanceWorker, setAttendanceWorker] = useState(
    () => searchParams.get("worker") || "",
  );
  const [reportTab, setReportTab] = useState("ATTENDANCE");
  const [analyticsData, setAnalyticsData] = useState();
  const [workerOptions, setWorkerOptions] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [companyProfileLoading, setCompanyProfileLoading] = useState(true);
  const [companyProfileError, setCompanyProfileError] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [workZoneFilter, setWorkZoneFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [workerStatus, setWorkerStatus] = useState("ACTIVE");
  const [paymentKind, setPaymentKind] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [expandedWorker, setExpandedWorker] = useState("");
  const [attendancePrintMode, setAttendancePrintMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [pages, setPages] = useState({});
  const [error, setError] = useState("");
  const loadSequence = useRef(0);
  const previousPrintPageSize = useRef(null);
  useEffect(() => {
    const handleAfterPrint = () => {
      setAttendancePrintMode(false);
      if (previousPrintPageSize.current !== null) {
        setPageSize(previousPrintPageSize.current);
        previousPrintPageSize.current = null;
      }
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);
  useEffect(() => {
    document.body.classList.toggle("attendance-pdf-mode", attendancePrintMode);
    return () => document.body.classList.remove("attendance-pdf-mode");
  }, [attendancePrintMode]);
  const printAttendanceReport = () => {
    previousPrintPageSize.current = pageSize;
    setPageSize(Math.max(25, attendanceData?.workerSummaries?.length || 0));
    setPages((current) => ({ ...current, attendance: 1 }));
    setAttendancePrintMode(true);
    window.setTimeout(() => window.print(), 0);
  };
  const downloadTransactionStatement = async () => {
    if (!companyProfile?.companyName || !data?.payments) return;
    try {
      const { downloadTransactionStatementPdf } = await import(
        "../utils/transactionStatementPdf.js"
      );
      downloadTransactionStatementPdf({
        profile: companyProfile,
        from,
        to,
        payments: data.payments,
        includeSerialNumber: true,
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const load = () => {
    const sequence = ++loadSequence.current;
    setError("");
    if (!from || !to) {
      setLoading(false);
      setError("Select both a from date and a to date.");
      return Promise.resolve();
    }
    if (from > to) {
      setLoading(false);
      setError("From date must be on or before To date.");
      return Promise.resolve();
    }
    setLoading(true);
    return Promise.all([
      request(
        api.get("/reports/operations", {
          params: {
            type,
            from,
            to,
            worker: attendanceWorker,
            workerStatus,
            companyName: companyFilter,
            teamName: teamFilter,
            workZone: workZoneFilter,
            skill: skillFilter,
            kind: paymentKind,
            method: paymentMethod,
          },
        }),
      ),
      request(
        api.get("/reports/attendance", {
          params: {
            from,
            to,
            worker: attendanceWorker,
            workerStatus,
            companyName: companyFilter,
            teamName: teamFilter,
            workZone: workZoneFilter,
            skill: skillFilter,
          },
        }),
      ),
      request(
        api.get("/dashboard/analytics", {
          params: {
            from,
            to,
            worker: attendanceWorker,
            workerStatus,
            companyName: companyFilter,
            teamName: teamFilter,
            workZone: workZoneFilter,
            skill: skillFilter,
            kind: paymentKind,
            method: paymentMethod,
          },
        }),
      ),
    ])
      .then(([operations, attendance, analytics]) => {
        if (sequence !== loadSequence.current) return;
        setData(operations);
        setAttendanceData(attendance);
        setAnalyticsData(analytics);
        setExpandedWorker("");
      })
      .catch((err) => {
        if (sequence === loadSequence.current) setError(errorMessage(err));
      })
      .finally(() => {
        if (sequence === loadSequence.current) setLoading(false);
      });
  };
  useEffect(() => {
    loadSequence.current += 1;
    const timer = window.setTimeout(() => load(), 250);
    const unsubscribeFromPaymentChanges = subscribeToPaymentChanges(load);
    return () => {
      window.clearTimeout(timer);
      unsubscribeFromPaymentChanges();
    };
  }, [
    from,
    to,
    attendanceWorker,
    companyFilter,
    teamFilter,
    workZoneFilter,
    skillFilter,
    workerStatus,
    paymentKind,
    paymentMethod,
  ]);
  useEffect(() => {
    setPages({});
    setExpandedWorker("");
  }, [
    from,
    to,
    attendanceWorker,
    companyFilter,
    teamFilter,
    workZoneFilter,
    skillFilter,
    workerStatus,
    paymentKind,
    paymentMethod,
  ]);
  useEffect(() => {
    request(api.get("/workers", { params: { type } }))
      .then(({ workers: result }) => setWorkerOptions(result || []))
      .catch((err) => setError(errorMessage(err)));
  }, [type]);
  useEffect(() => {
    request(api.get("/company-profile"))
      .then(({ profile }) => setCompanyProfile(profile))
      .catch((err) => {
        setCompanyProfileError(
          "Report data is available, but PDF export is unavailable because company details could not be loaded.",
        );
        console.warn("Company profile unavailable for report PDF branding:", err);
      })
      .finally(() => setCompanyProfileLoading(false));
  }, []);
  const rowsForPage = (key, rows = []) => {
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.min(pages[key] || 1, pageCount);
    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      page,
    };
  };
  const changePage = (key, page) =>
    setPages((current) => ({ ...current, [key]: page }));
  const changePageSize = (value) => {
    setPageSize(value);
    setPages({});
  };
  const attendancePage = rowsForPage(
    "attendance",
    attendanceData?.workerSummaries || [],
  );
  const payrollPage = rowsForPage("payroll", data?.payments || []);
  const transactionPage = rowsForPage("transactions", data?.payments || []);
  const exceptionPage = rowsForPage(
    "exceptions",
    analyticsData?.exceptions || [],
  );
  const payrollSummaryPage = rowsForPage(
    "payroll-summary",
    Object.entries(analyticsData?.paymentKinds || {}),
  );
  const managementPage = rowsForPage(
    "management",
    analyticsData?.managementWorkers || [],
  );
  const reportTabLabels = {
    ATTENDANCE: "Attendance",
    PAYROLL: "Payroll",
    STATEMENT: "Transaction statement",
    WORKFORCE: "Workforce",
    EXCEPTIONS: "Exceptions",
    MANAGEMENT: "Management",
  };
  const workforceDimensions = ["company", "team", "workZone", "skill"].map(
    (dimension) => {
      const entries = Object.entries(
        analyticsData?.composition?.[dimension] || {},
      ).sort((left, right) => right[1] - left[1]);
      return {
        dimension,
        ...rowsForPage(`workforce-${dimension}`, entries),
        total: entries.length,
      };
    },
  );
  return (
    <div
      className={`reports-print-root${attendancePrintMode ? " attendance-print-root" : ""}`}
    >
      <header className="report-print-heading">
        <p>LABOUR OPERATIONS REPORT</p>
        <h1>{companyProfile?.companyName || "Company name unavailable"}</h1>
        <div>
          <span>
            <strong>Report</strong> {reportTabLabels[reportTab]}
          </span>
          {companyFilter && (
            <span>
              <strong>Client</strong> {companyFilter}
            </span>
          )}
          <span>
            <strong>Labour</strong>{" "}
            {workerStatus === "ACTIVE"
              ? "Active"
              : workerStatus === "INACTIVE"
                ? "Inactive"
                : workerStatus === "WENT_HOME"
                  ? "Went Home"
                  : "All"}
          </span>
          <span>
            <strong>Period</strong> {date(`${from}T00:00:00`)} –{" "}
            {date(`${to}T00:00:00`)}
          </span>
        </div>
      </header>
      <PageHeader
        className="reports-page-header"
        eyebrow="ANALYTICS & RECORDS"
        title="Labour operations report"
        detail="Filter labour work and payment movement by period."
        action={
          <Button
            icon={Printer}
            className={`${styles["button-secondary"]}`}
            onClick={() => window.print()}
            disabled={companyProfileLoading || !companyProfile?.companyName}
          >
            Print / save PDF
          </Button>
        }
      />
      <ErrorNote error={companyProfileError} />
      <Panel
        className="report-filter-panel"
        title="Report filters"
        detail="Reports refresh automatically when filters change. Select both dates and use Apply filters to refresh manually."
      >
        <div className={`${styles["toolbar"]} ${styles["filter-bar"]}`}>
          <Field label="From date">
            <input
              required
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="To date">
            <input
              required
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
          <Field label="Worker">
            <select
              value={attendanceWorker}
              onChange={(event) => setAttendanceWorker(event.target.value)}
            >
              <option value="">All workers</option>
              {workerOptions.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Labour status">
            <select
              value={workerStatus}
              onChange={(event) => setWorkerStatus(event.target.value)}
            >
              <option value="ACTIVE">Active labour</option>
              <option value="INACTIVE">Inactive labour</option>
              <option value="WENT_HOME">Went Home</option>
              <option value="ALL">All labour</option>
            </select>
          </Field>
          {[
            ["Company", "companies", companyFilter, setCompanyFilter, "companyName"],
            ["Team", "teams", teamFilter, setTeamFilter, "teamName"],
            ["Location", "locations", workZoneFilter, setWorkZoneFilter, "workZone"],
            ["Skill", "skills", skillFilter, setSkillFilter, "skill"],
          ].map(([label, pluralLabel, value, setter, field]) => (
            <Field label={label} key={field}>
              <select
                value={value}
                onChange={(event) => setter(event.target.value)}
              >
                <option value="">All {pluralLabel}</option>
                {[
                  ...new Set(
                    workerOptions
                      .map((worker) => worker[field] || "Unassigned"),
                  ),
                ]
                  .sort()
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
            </Field>
          ))}
          <Field label="Payment type">
            <select
              value={paymentKind}
              onChange={(event) => setPaymentKind(event.target.value)}
            >
              <option value="">All types</option>
              <option value="WAGE">Wage</option>
              <option value="ADVANCE">Advance</option>
              <option value="TRAVEL_ADVANCE">Travel advance</option>
              <option value="EXPENSE">Kharchi</option>
              <option value="REFUND">Labour return</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Payment method">
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option value="">All methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK">Bank</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Button
            icon={RefreshCcw}
            className={`${styles["button-primary"]}`}
            onClick={load}
            disabled={loading}
          >
            {loading ? "Applying…" : "Apply filters"}
          </Button>
        </div>
        <ErrorNote error={error} />
      </Panel>
      <div
        className={`${styles["report-tabs"]} report-section-tabs`}
        role="tablist"
        aria-label="Report sections"
      >
        {[
          ["ATTENDANCE", "Attendance"],
          ["PAYROLL", "Payroll"],
          ["STATEMENT", "Transaction statement"],
          ["WORKFORCE", "Workforce"],
          ["EXCEPTIONS", "Exceptions"],
          ["MANAGEMENT", "Management"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={reportTab === value}
            className={reportTab === value ? styles.active : ""}
            onClick={() => setReportTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {reportTab === "ATTENDANCE" && (
        <Panel
          title="Attendance report"
          detail="Attendance, unmarked days and attendance-based payable for matching active labour."
          className="attendance-report-panel"
          action={
            <div className="attendance-print-action">
              <Button
                icon={Printer}
                className={`${styles["button-secondary"]}`}
                onClick={printAttendanceReport}
                disabled={
                  companyProfileLoading ||
                  !companyProfile?.companyName ||
                  !attendanceData?.workerSummaries?.length
                }
              >
                Attendance PDF
              </Button>
            </div>
          }
        >
          <div className={styles["report-summary-grid"]}>
            {[
              ["Workers", attendanceData?.workerSummaries?.length || 0],
              ["Present", attendanceData?.summary?.PRESENT || 0],
              ["Absent", attendanceData?.summary?.ABSENT || 0],
              ["Unmarked", attendanceData?.summary?.NOT_MARKED || 0],
              ["Payable", money(attendanceData?.summary?.payable || 0)],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <ReportPagination
            total={attendanceData?.workerSummaries?.length || 0}
            page={attendancePage.page}
            pageSize={pageSize}
            onPageChange={(page) => changePage("attendance", page)}
            onPageSizeChange={changePageSize}
          />
          <div className={`${styles["table-wrap"]}`}>
            <table>
              <thead>
                <tr>
                  <th className="reports-pdf-serial">Sr. No.</th>
                  <th>Worker</th>
                  <th>Present</th>
                  <th>2P</th>
                  <th>3P</th>
                  <th>Absent</th>
                  <th>Half day</th>
                  <th>Leave</th>
                  <th>Not marked</th>
                  <th>Payable</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {attendancePage.rows.map((worker, index) => {
                  const isExpanded = expandedWorker === worker.workerId;
                  const dailyPage = rowsForPage(
                    `attendance-days-${worker.workerId}`,
                    worker.records,
                  );
                  return (
                    <Fragment key={worker.workerId}>
                      <tr>
                        <td className="reports-pdf-serial">
                          {(attendancePage.page - 1) * pageSize + index + 1}
                        </td>
                        <td>
                          <strong>{worker.workerName}</strong>
                          <small>
                            Labour
                          </small>
                        </td>
                        <td>{worker.PRESENT}</td>
                        <td>{worker.DOUBLE_PRESENT}</td>
                        <td>{worker.TRIPLE_PRESENT}</td>
                        <td>{worker.ABSENT}</td>
                        <td>{worker.HALF_DAY}</td>
                        <td>{worker.LEAVE}</td>
                        <td>{worker.NOT_MARKED}</td>
                        <td>{money(worker.payable)}</td>
                        <td>
                          <button
                            className={`${styles["icon-button"]}`}
                            type="button"
                            title={
                              isExpanded
                                ? "Hide daily details"
                                : "Show daily details"
                            }
                            onClick={() =>
                              setExpandedWorker(
                                isExpanded ? "" : worker.workerId,
                              )
                            }
                          >
                            {isExpanded ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="10">
                            <div className={`${styles["table-wrap"]}`}>
                              <table>
                                <thead>
                                  <tr>
                                    <th className="reports-pdf-serial">Sr. No.</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Work units</th>
                                    <th>Payable</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dailyPage.rows.map((record, recordIndex) => (
                                    <tr
                                      key={`${worker.workerId}-${record.date}`}
                                    >
                                      <td className="reports-pdf-serial">
                                        {(dailyPage.page - 1) * pageSize + recordIndex + 1}
                                      </td>
                                      <td>{date(record.date)}</td>
                                      <td>
                                        {record.status.replaceAll("_", " ")}
                                      </td>
                                      <td>{record.workUnits}</td>
                                      <td>{money(record.payableAmount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <ReportPagination
                              total={worker.records.length}
                              page={dailyPage.page}
                              pageSize={pageSize}
                              onPageChange={(page) =>
                                changePage(
                                  `attendance-days-${worker.workerId}`,
                                  page,
                                )
                              }
                              onPageSizeChange={changePageSize}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {!attendanceData?.workerSummaries?.length && (
                  <tr>
                    <td className="reports-pdf-serial" />
                    <td colSpan="10">
                      <Empty title="No active labour for this filter" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {reportTab === "STATEMENT" && (
        <Panel
          title="Account statement"
          detail={`All matching transactions · ${date(`${from}T00:00:00`)} – ${date(`${to}T00:00:00`)}`}
          action={
            <Button
              icon={Download}
              className={styles["button-primary"]}
              onClick={downloadTransactionStatement}
              disabled={
                loading ||
                companyProfileLoading ||
                !companyProfile?.companyName ||
                !data?.payments
              }
            >
              Download statement PDF
            </Button>
          }
        >
          <div className={styles["report-summary-grid"]}>
            {[
              ["Total debit · Paid out", money(data?.summary?.outflow || 0)],
              ["Total credit · Received", money(data?.summary?.inflow || 0)],
              [
                "Net balance · Period movement",
                `${money(Math.abs(Number(data?.summary?.outflow || 0) - Number(data?.summary?.inflow || 0)))} ${Number(data?.summary?.outflow || 0) >= Number(data?.summary?.inflow || 0) ? "Dr" : "Cr"}`,
              ],
              ["No. of entries", number(data?.payments?.length || 0)],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <ReportPagination
            total={data?.payments?.length || 0}
            page={transactionPage.page}
            pageSize={pageSize}
            onPageChange={(page) => changePage("transactions", page)}
            onPageSizeChange={changePageSize}
          />
          <div className={styles["table-wrap"]}>
            <table>
              <thead>
                <tr>
                  <th className="reports-pdf-serial">Sr. No.</th>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Details</th>
                  <th>Debit (-)</th>
                  <th>Credit (+)</th>
                </tr>
              </thead>
              <tbody>
                {transactionPage.rows.map((payment, index) => (
                  <tr key={payment._id}>
                    <td className="reports-pdf-serial">
                      {(transactionPage.page - 1) * pageSize + index + 1}
                    </td>
                    <td>{date(payment.paidOn)}</td>
                    <td>{payment.worker?.name || "Business expense"}</td>
                    <td>
                      {payment.kind.replaceAll("_", " ")}
                      {payment.method ? ` · ${payment.method}` : ""}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                      {payment.notes ? ` · ${payment.notes}` : ""}
                    </td>
                    <td className={payment.flow === "OUTFLOW" ? styles["expense"] : undefined}>
                      {payment.flow === "OUTFLOW" ? money(payment.amount) : "—"}
                    </td>
                    <td className={payment.flow === "INFLOW" ? styles["income"] : undefined}>
                      {payment.flow === "INFLOW" ? money(payment.amount) : "—"}
                    </td>
                  </tr>
                ))}
                {!data?.payments?.length && (
                  <tr>
                    <td className="reports-pdf-serial" />
                    <td colSpan="5">
                      <Empty title="No transactions for this filter" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {reportTab === "PAYROLL" && (
        <Panel
          title="Payment ledger"
          detail="Selected-period outflows, returns, advances and business expenses."
        >
          <div className={styles["report-summary-grid"]}>
            {[
              ["Transactions", data?.payments?.length || 0],
              ["Paid out", money(data?.summary?.outflow || 0)],
              ["Received", money(data?.summary?.inflow || 0)],
              ["Advances", money(data?.summary?.advance || 0)],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <ReportPagination
            total={data?.payments?.length || 0}
            page={payrollPage.page}
            pageSize={pageSize}
            onPageChange={(page) => changePage("payroll", page)}
            onPageSizeChange={changePageSize}
          />
          <div className={`${styles["table-wrap"]}`}>
            <table>
              <thead>
                <tr>
                  <th className="reports-pdf-serial">Sr. No.</th>
                  <th>Date</th>
                  <th>Worker</th>
                  <th>Type</th>
                  <th>Diya</th>
                  <th>Liya</th>
                </tr>
              </thead>
              <tbody>
                {payrollPage.rows.map((payment, index) => (
                  <tr key={payment._id}>
                    <td className="reports-pdf-serial">
                      {(payrollPage.page - 1) * pageSize + index + 1}
                    </td>
                    <td>{date(payment.paidOn)}</td>
                    <td>{payment.worker?.name || "Business expense"}</td>
                    <td>
                      {payment.flow === "INFLOW"
                        ? `Liya · ${payment.kind.replace("_", " ")}`
                        : payment.kind.replace("_", " ")}
                    </td>
                    <td
                      className={
                        payment.flow === "INFLOW"
                          ? undefined
                          : `${styles["amount"]} ${styles["expense"]}`
                      }
                    >
                      {payment.flow === "INFLOW" ? "—" : money(payment.amount)}
                    </td>
                    <td className={`${styles["income"]}`}>
                      {payment.flow === "INFLOW" ? money(payment.amount) : "—"}
                    </td>
                  </tr>
                ))}
                {!data?.payments?.length && (
                  <tr>
                    <td className="reports-pdf-serial" />
                    <td colSpan="5">
                      <Empty title="No payments for this filter" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {analyticsData && reportTab === "MANAGEMENT" && (
        <>
          <div
            className={`${styles["metric-grid"]} ${styles["compact-metrics"]}`}
          >
            <Metric
              label="Attendance rate"
              value={`${analyticsData.kpis.attendanceRate}%`}
              detail="Selected period"
            />
            <Metric
              label="Period payable"
              value={money(analyticsData.kpis.payable)}
              detail={`${analyticsData.kpis.overtimeHours} OT hours`}
              tone="amber"
            />
            <Metric
              label="Period paid"
              value={money(analyticsData.kpis.paid)}
              detail="Payment records in range"
              tone="blue"
            />
            <Metric
              label="Lifetime due"
              value={money(analyticsData.kpis.lifetimeDue)}
              detail="Filtered workforce"
              tone="coral"
            />
          </div>
          <Panel
            title="Management snapshot"
            detail="The main operational numbers for the selected period."
          >
            <div className={`${styles["report-summary-grid"]}`}>
              <div>
                <span>
                  {workerStatus === "ACTIVE"
                    ? "Active workers"
                    : workerStatus === "INACTIVE"
                      ? "Inactive workers"
                      : workerStatus === "WENT_HOME"
                        ? "Went Home workers"
                      : "Matching workers"}
                </span>
                <strong>
                  {workerStatus === "ACTIVE"
                    ? analyticsData.kpis.activeWorkers
                    : workerStatus === "INACTIVE"
                      ? analyticsData.kpis.inactiveWorkers
                      : analyticsData.kpis.activeWorkers +
                        analyticsData.kpis.inactiveWorkers}
                </strong>
              </div>
              <div>
                <span>Present entries</span>
                <strong>{analyticsData.kpis.present}</strong>
              </div>
              <div>
                <span>Unmarked entries</span>
                <strong>{analyticsData.kpis.unmarked}</strong>
              </div>
              <div>
                <span>Range</span>
                <strong>
                  {analyticsData.range.from} to {analyticsData.range.to}
                </strong>
              </div>
            </div>
          </Panel>
        </>
      )}
      {analyticsData && reportTab === "WORKFORCE" && (
        <div className={`${styles["content-grid"]} ${styles["two-one"]}`}>
          {workforceDimensions.map(({ dimension, rows, page, total }) => (
            <Panel
              title={`${dimension === "workZone" ? "Location" : dimension} distribution`}
              key={dimension}
            >
              <div className={`${styles["report-rank-list"]}`}>
                {rows.map(([label, count], index) => (
                  <div key={label}>
                    <small className="reports-pdf-rank-serial">
                      {(page - 1) * pageSize + index + 1}.
                    </small>
                    <strong>{label}</strong>
                    <span>{count}</span>
                  </div>
                ))}
                {!total && <Empty title="No matching workforce data" />}
              </div>
              <ReportPagination
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={(nextPage) =>
                  changePage(`workforce-${dimension}`, nextPage)
                }
                onPageSizeChange={changePageSize}
              />
            </Panel>
          ))}
        </div>
      )}
      {analyticsData && reportTab === "EXCEPTIONS" && (
        <Panel
          title="Attendance exceptions"
          detail="Workers with absences, leave, half-days, overtime or unmarked attendance in this period."
        >
          <ReportPagination
            total={analyticsData.exceptions?.length || 0}
            page={exceptionPage.page}
            pageSize={pageSize}
            onPageChange={(page) => changePage("exceptions", page)}
            onPageSizeChange={changePageSize}
          />
          <div className={`${styles["table-wrap"]}`}>
            <table>
              <thead>
                <tr>
                  <th className="reports-pdf-serial">Sr. No.</th>
                  <th>Worker</th>
                  <th>Unmarked</th>
                  <th>Absent</th>
                  <th>Leave</th>
                  <th>Half day</th>
                  <th>OT hours</th>
                </tr>
              </thead>
              <tbody>
                {exceptionPage.rows.map((item, index) => (
                  <tr key={item.workerId}>
                    <td className="reports-pdf-serial">
                      {(exceptionPage.page - 1) * pageSize + index + 1}
                    </td>
                    <td>
                      <strong>{item.workerName}</strong>
                    </td>
                    <td>{item.notMarked}</td>
                    <td>{item.absent}</td>
                    <td>{item.leave}</td>
                    <td>{item.halfDay}</td>
                    <td>{item.overtimeHours}</td>
                  </tr>
                ))}
                {!analyticsData.exceptions?.length && (
                  <tr>
                    <td className="reports-pdf-serial" />
                    <td colSpan="6">
                      <Empty title="No attendance exceptions" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {analyticsData && reportTab === "PAYROLL" && (
        <Panel
          title="Payment summary"
          detail="Net type totals for matching payments; incoming refunds and adjustments reduce the total."
        >
          <ReportPagination
            total={Object.keys(analyticsData.paymentKinds || {}).length}
            page={payrollSummaryPage.page}
            pageSize={pageSize}
            onPageChange={(page) => changePage("payroll-summary", page)}
            onPageSizeChange={changePageSize}
          />
          <div className={`${styles["report-summary-grid"]}`}>
            {payrollSummaryPage.rows.map(
              ([kind, amount]) => (
                <div key={kind}>
                  <span>{kind.replaceAll("_", " ")}</span>
                  <strong>{money(amount)}</strong>
                </div>
              ),
            )}
            {!Object.keys(analyticsData.paymentKinds || {}).length && (
              <Empty title="No payments in this period" />
            )}
          </div>
        </Panel>
      )}
      {analyticsData && reportTab === "MANAGEMENT" && (
        <Panel
          title="Worker management details"
          detail="Period attendance/payables and payments alongside each worker's lifetime due."
        >
          <ReportPagination
            total={analyticsData.managementWorkers?.length || 0}
            page={managementPage.page}
            pageSize={pageSize}
            onPageChange={(page) => changePage("management", page)}
            onPageSizeChange={changePageSize}
          />
          <div className={styles["table-wrap"]}>
            <table>
              <thead>
                <tr>
                  <th className="reports-pdf-serial">Sr. No.</th>
                  <th>Worker</th>
                  <th>Company</th>
                  <th>Team</th>
                  <th>Location</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Half day</th>
                  <th>Leave</th>
                  <th>Unmarked</th>
                  <th>OT hours</th>
                  <th>Period payable</th>
                  <th>Period paid</th>
                  <th>Lifetime due</th>
                </tr>
              </thead>
              <tbody>
                {managementPage.rows.map((worker, index) => (
                  <tr key={worker.workerId}>
                    <td className="reports-pdf-serial">
                      {(managementPage.page - 1) * pageSize + index + 1}
                    </td>
                    <td><strong>{worker.workerName}</strong></td>
                    <td>{worker.company}</td>
                    <td>{worker.team}</td>
                    <td>{worker.location}</td>
                    <td>{worker.present}</td>
                    <td>{worker.absent}</td>
                    <td>{worker.halfDay}</td>
                    <td>{worker.leave}</td>
                    <td>{worker.unmarked}</td>
                    <td>{worker.overtimeHours}</td>
                    <td>{money(worker.payable)}</td>
                    <td>{money(worker.paid)}</td>
                    <td>{money(worker.lifetimeDue)}</td>
                  </tr>
                ))}
                {!analyticsData.managementWorkers?.length && (
                  <tr>
                    <td className="reports-pdf-serial" />
                    <td colSpan="13">
                      <Empty title="No workers match these filters" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
