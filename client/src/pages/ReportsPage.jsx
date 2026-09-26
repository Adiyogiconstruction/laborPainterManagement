import styles from "../styles/design.module.css";
import { Fragment, useEffect, useMemo, useState } from "react";
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

export function ReportsPage({ businessType = "LABOUR" }) {
  const type = businessType;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState();
  const [attendanceData, setAttendanceData] = useState();
  const [attendanceWorkers, setAttendanceWorkers] = useState([]);
  const [attendanceWorker, setAttendanceWorker] = useState("");
  const [reportTab, setReportTab] = useState("ATTENDANCE");
  const [analyticsData, setAnalyticsData] = useState();
  const [workerOptions, setWorkerOptions] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [workZoneFilter, setWorkZoneFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [paymentKind, setPaymentKind] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [expandedWorker, setExpandedWorker] = useState("");
  const [attendancePrintMode, setAttendancePrintMode] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const handleAfterPrint = () => setAttendancePrintMode(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);
  useEffect(() => {
    document.body.classList.toggle("attendance-pdf-mode", attendancePrintMode);
    return () => document.body.classList.remove("attendance-pdf-mode");
  }, [attendancePrintMode]);
  const printAttendanceReport = () => {
    setAttendancePrintMode(true);
    window.setTimeout(() => window.print(), 0);
  };
  const load = () => {
    setError("");
    return Promise.all([
      request(
        api.get("/reports/operations", {
          params: {
            type,
            from,
            to,
            worker: attendanceWorker,
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
            ...(attendanceWorker ? { worker: attendanceWorker } : {}),
          },
        }),
      ),
      request(
        api.get("/dashboard/analytics", {
          params: {
            from,
            to,
            worker: attendanceWorker,
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
        setData(operations);
        setAttendanceData(attendance);
        setAnalyticsData(analytics);
        if (!attendanceWorker)
          setAttendanceWorkers(attendance.workerSummaries || []);
        setExpandedWorker("");
      })
      .catch((err) => setError(errorMessage(err)));
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    request(api.get("/workers", { params: { type } }))
      .then(({ workers: result }) => setWorkerOptions(result || []))
      .catch((err) => setError(errorMessage(err)));
  }, [type]);
  const summary = data?.summary || {
    inflow: 0,
    outflow: 0,
    advance: 0,
  };
  return (
    <div className={attendancePrintMode ? "attendance-print-root" : undefined}>
      <PageHeader
        eyebrow="ANALYTICS & RECORDS"
        title={
          type === "PAINTER"
            ? "Painter operations report"
            : "Labour operations report"
        }
        detail={
          type === "PAINTER"
            ? "Filter painter work, cash and paint movement by period."
            : "Filter labour work and payment movement by period."
        }
        action={
          <Button
            icon={Printer}
            className={`${styles["button-secondary"]}`}
            onClick={() => window.print()}
          >
            Print / save PDF
          </Button>
        }
      />
      <Panel
        title="Report filters"
        detail="Apply a date range to inspect a particular period."
      >
        <div className={`${styles["toolbar"]} ${styles["filter-bar"]}`}>
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
          {[
            ["Company", companyFilter, setCompanyFilter, "companyName"],
            ["Team", teamFilter, setTeamFilter, "teamName"],
            ["Location", workZoneFilter, setWorkZoneFilter, "workZone"],
            ["Skill", skillFilter, setSkillFilter, "skill"],
          ].map(([label, value, setter, field]) => (
            <Field label={label} key={field}>
              <select
                value={value}
                onChange={(event) => setter(event.target.value)}
              >
                <option value="">All {label.toLowerCase()}s</option>
                {[
                  ...new Set(
                    workerOptions
                      .map((worker) => worker[field])
                      .filter(Boolean),
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
          >
            Apply filters
          </Button>
        </div>
        <ErrorNote error={error} />
      </Panel>
      <div
        className={`${styles["report-tabs"]}`}
        role="tablist"
        aria-label="Report sections"
      >
        {[
          ["ATTENDANCE", "Attendance"],
          ["PAYROLL", "Payroll"],
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
          detail="Compare every active labour worker across the selected period."
          className="attendance-report-panel"
          action={
            <div className="attendance-print-action">
              <Button
                icon={Printer}
                className={`${styles["button-secondary"]}`}
                onClick={printAttendanceReport}
                disabled={!attendanceData?.workerSummaries?.length}
              >
                Attendance PDF
              </Button>
            </div>
          }
        >
          <div className={`${styles["table-wrap"]}`}>
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Present</th>
                  <th>2P</th>
                  <th>Absent</th>
                  <th>Half day</th>
                  <th>Leave</th>
                  <th>Not marked</th>
                  <th>Payable</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData?.workerSummaries?.map((worker) => {
                  const isExpanded = expandedWorker === worker.workerId;
                  return (
                    <Fragment key={worker.workerId}>
                      <tr>
                        <td>
                          <strong>{worker.workerName}</strong>
                          <small>
                            {worker.type === "PAINTER" ? "Painter" : "Labour"}
                          </small>
                        </td>
                        <td>{worker.PRESENT}</td>
                        <td>{worker.DOUBLE_PRESENT}</td>
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
                          <td colSpan="9">
                            <div className={`${styles["table-wrap"]}`}>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Work units</th>
                                    <th>Payable</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {worker.records.map((record) => (
                                    <tr
                                      key={`${worker.workerId}-${record.date}`}
                                    >
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
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {!attendanceData?.workerSummaries?.length && (
                  <tr>
                    <td colSpan="9">
                      <Empty title="No active labour for this filter" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {reportTab === "PAYROLL" && (
        <Panel title="Payment ledger" detail="Money paid to the workforce.">
          <div className={`${styles["table-wrap"]}`}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Worker</th>
                  <th>Type</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data?.payments?.map((payment) => (
                  <tr key={payment._id}>
                    <td>{date(payment.paidOn)}</td>
                    <td>{payment.worker?.name || "Business expense"}</td>
                    <td>{payment.kind.replace("_", " ")}</td>
                    <td className={`${styles["amount"]} ${styles["expense"]}`}>
                      {money(payment.amount)}
                    </td>
                  </tr>
                ))}
                {!data?.payments?.length && (
                  <tr>
                    <td colSpan="4">
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
                <span>Active workers</span>
                <strong>{analyticsData.kpis.activeWorkers}</strong>
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
          {["company", "team", "workZone", "skill"].map((dimension) => (
            <Panel
              title={`${dimension === "workZone" ? "Location" : dimension} distribution`}
              key={dimension}
            >
              <div className={`${styles["report-rank-list"]}`}>
                {Object.entries(analyticsData.composition?.[dimension] || {})
                  .sort((left, right) => right[1] - left[1])
                  .map(([label, count]) => (
                    <div key={label}>
                      <strong>{label}</strong>
                      <span>{count}</span>
                    </div>
                  ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
      {analyticsData && reportTab === "EXCEPTIONS" && (
        <Panel
          title="Attendance exceptions"
          detail="Workers needing follow-up in the selected period."
        >
          <div className={`${styles["table-wrap"]}`}>
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Unmarked</th>
                  <th>Absent</th>
                  <th>Leave</th>
                  <th>Half day</th>
                  <th>OT hours</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.exceptions?.map((item) => (
                  <tr key={item.workerId}>
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
          detail="Payment type totals for the selected period."
        >
          <div className={`${styles["report-summary-grid"]}`}>
            {Object.entries(analyticsData.paymentKinds || {}).map(
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
    </div>
  );
}
