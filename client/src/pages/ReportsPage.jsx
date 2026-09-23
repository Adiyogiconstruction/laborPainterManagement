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
      request(api.get("/reports/operations", { params: { type, from, to } })),
      request(
        api.get("/reports/attendance", {
          params: {
            from,
            to,
            ...(attendanceWorker ? { worker: attendanceWorker } : {}),
          },
        }),
      ),
    ])
      .then(([operations, attendance]) => {
        setData(operations);
        setAttendanceData(attendance);
        if (!attendanceWorker)
          setAttendanceWorkers(attendance.workerSummaries || []);
        setExpandedWorker("");
      })
      .catch((err) => setError(errorMessage(err)));
  };
  useEffect(() => {
    load();
  }, []);
  const summary = data?.summary || {
    billed: 0,
    payout: 0,
    inflow: 0,
    outflow: 0,
    advance: 0,
    profit: 0,
    headCount: 0,
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
        <div className={`${styles["toolbar"]} ${styles["filter-bar"]}`}>
          <Field label="Labour">
            <select
              value={attendanceWorker}
              onChange={(event) => setAttendanceWorker(event.target.value)}
            >
              <option value="">All labour</option>
              {attendanceWorkers.map((worker) => (
                <option key={worker.workerId} value={worker.workerId}>
                  {worker.workerName}
                </option>
              ))}
            </select>
          </Field>
          <Button
            icon={RefreshCcw}
            className={`${styles["button-secondary"]}`}
            onClick={load}
          >
            Apply attendance filter
          </Button>
        </div>
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
                            setExpandedWorker(isExpanded ? "" : worker.workerId)
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
                                  <tr key={`${worker.workerId}-${record.date}`}>
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
      <div className={`${styles["metric-grid"]}`}>
        <Metric
          label="Client billing"
          value={money(summary.billed)}
          detail={`${number(summary.headCount)} people supplied`}
          tone="teal"
          icon={ReceiptText}
        />
        <Metric
          label="Worker payout"
          value={money(summary.payout)}
          detail="Expected cost for listed work"
          tone="coral"
          icon={UsersRound}
        />
        <Metric
          label="Cash received"
          value={money(summary.inflow)}
          detail="Recorded client receipts"
          tone="purple"
          icon={ArrowDownLeft}
        />
        <Metric
          label="Estimated gross margin"
          value={money(summary.profit)}
          detail="Billing minus worker cost"
          tone="amber"
          icon={CircleDollarSign}
        />
      </div>
      <Panel
        title={
          type === "PAINTER"
            ? "Painter work supply report"
            : "Labour work supply report"
        }
        detail={
          type === "PAINTER"
            ? "Every saved painter assignment in the selected period."
            : "Every saved labour assignment in the selected period."
        }
      >
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Worker</th>
                <th>Client / site</th>
                <th>People × days</th>
                <th>Billing</th>
                <th>Payout</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.assignments?.map((record) => (
                <tr key={record._id}>
                  <td>{date(record.startDate)}</td>
                  <td>
                    <Status tone={typeClass(record.type)}>
                      {typeTitle(record.type)}
                    </Status>
                  </td>
                  <td>{record.worker?.name}</td>
                  <td>
                    <strong>{record.client?.name}</strong>
                    <small>{record.siteName}</small>
                  </td>
                  <td>
                    {record.headCount} × {record.workDays}
                  </td>
                  <td className={`${styles["amount"]} ${styles["income"]}`}>
                    {money(record.billingAmount)}
                  </td>
                  <td className={`${styles["amount"]}`}>
                    {money(record.payoutAmount)}
                  </td>
                  <td>
                    <Status
                      tone={record.status === "ACTIVE" ? "blue" : "neutral"}
                    >
                      {record.status}
                    </Status>
                  </td>
                </tr>
              ))}
              {!data?.assignments?.length && (
                <tr>
                  <td colSpan="8">
                    <Empty
                      title="No work for this filter"
                      detail="Try a wider date range or create a work record."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Payment ledger"
        detail="Money received from clients and paid to the workforce."
      >
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Counterparty</th>
                <th>Type</th>
                <th>Flow</th>
                <th>Work record</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data?.payments?.map((payment) => (
                <tr key={payment._id}>
                  <td>{date(payment.paidOn)}</td>
                  <td>
                    {payment.client?.name ||
                      payment.worker?.name ||
                      "Business expense"}
                  </td>
                  <td>{payment.kind.replace("_", " ")}</td>
                  <td>
                    <Status tone={payment.flow === "INFLOW" ? "teal" : "coral"}>
                      {payment.flow === "INFLOW" ? "Received" : "Paid"}
                    </Status>
                  </td>
                  <td>{payment.assignment?.siteName || "—"}</td>
                  <td
                    className={`${styles["amount"]} ${styles[payment.flow === "INFLOW" ? "income" : "expense"]}`}
                  >
                    {money(payment.amount)}
                  </td>
                </tr>
              ))}
              {!data?.payments?.length && (
                <tr>
                  <td colSpan="6">
                    <Empty title="No payments for this filter" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
