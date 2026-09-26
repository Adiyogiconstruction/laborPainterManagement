import styles from "../styles/design.module.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  History,
  IndianRupee,
  Landmark,
  Pencil,
  Plus,
  Printer,
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
import { ErrorNote, Metric, errorMessage } from "./shared.jsx";

const monthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
};

const today = () => new Date().toISOString().slice(0, 10);

const chartValue = (value) => Number(value || 0).toLocaleString("en-IN");

const objectEntries = (value = {}) =>
  Object.entries(value)
    .map(([label, amount]) => ({ label, amount: Number(amount || 0) }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 6);

export function DashboardPage({ businessType = "LABOUR" }) {
  const navigate = useNavigate();
  const workspace = businessType.toLowerCase();
  const [data, setData] = useState();
  const [painterData, setPainterData] = useState({
    workers: [],
    paintTransactions: [],
    paintBalances: [],
    payments: [],
  });
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    worker: "",
    companyName: "",
    teamName: "",
    workZone: "",
    skill: "",
  });
  const [selectedAttendancePoint, setSelectedAttendancePoint] = useState(null);
  const load = () =>
    request(api.get("/dashboard/summary", { params: { type: businessType } }))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    load();
  }, [businessType]);
  const loadAnalytics = () =>
    request(
      api.get("/dashboard/analytics", {
        params: {
          from,
          to,
          type: businessType,
          ...Object.fromEntries(
            Object.entries(analyticsFilters).filter(([, value]) => value),
          ),
        },
      }),
    )
      .then(setAnalytics)
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    if (businessType !== "LABOUR") {
      setAnalytics(undefined);
      return;
    }
    loadAnalytics();
  }, [businessType, from, to, ...Object.values(analyticsFilters)]);
  useEffect(() => {
    if (businessType !== "PAINTER") return;
    Promise.all([
      request(api.get("/workers", { params: { type: businessType } })),
      request(api.get("/paint")),
      request(api.get("/payments", { params: { type: businessType } })),
    ])
      .then(([workersResult, paintResult, paymentsResult]) => {
        setPainterData({
          workers: workersResult.workers || [],
          paintTransactions: paintResult.transactions || [],
          paintBalances: paintResult.balances || [],
          payments: paymentsResult.payments || [],
        });
      })
      .catch((err) => setError(errorMessage(err)));
  }, [businessType]);
  useEffect(() => {
    if (!analytics?.attendanceByDate?.length) {
      setSelectedAttendancePoint(null);
      return;
    }
    setSelectedAttendancePoint((current) => {
      if (
        current &&
        analytics.attendanceByDate.some((item) => item.date === current.date)
      ) {
        return current;
      }
      return analytics.attendanceByDate[analytics.attendanceByDate.length - 1];
    });
  }, [analytics?.attendanceByDate]);
  if (!data)
    return (
      <>
        <PageHeader
          eyebrow="OVERVIEW"
          title="Good morning"
          detail="A complete view of today’s workforce and money."
        />
        <ErrorNote error={error} />
        <Panel>
          <Empty
            title="Loading dashboard…"
            detail="Fetching the latest business numbers."
          />
        </Panel>
      </>
    );
  const { summary, latestPayments, outstanding } = data;
  const workspaceLabel = businessType === "PAINTER" ? "Painter" : "Labour";
  const activePeople =
    businessType === "PAINTER" ? summary.activePainters : summary.activeLabour;
  const payable =
    businessType === "PAINTER" ? summary.painterPayable : summary.labourPayable;
  const painterSummary =
    businessType === "PAINTER"
      ? painterData.workers.reduce(
          (accumulator, worker) => {
            accumulator.active += worker.active ? 1 : 0;
            accumulator.totalDue += Number(worker.totalDue || 0);
            return accumulator;
          },
          { active: 0, totalDue: 0 },
        )
      : null;
  const paintSummary =
    businessType === "PAINTER"
      ? painterData.paintTransactions.reduce(
          (accumulator, item) => {
            const quantity = Number(item.quantity || 0);
            if (item.kind === "ISSUED") accumulator.issued += quantity;
            if (item.kind === "PURCHASED") accumulator.purchased += quantity;
            if (item.kind === "USED") accumulator.used += quantity;
            if (item.kind === "RETURNED") accumulator.returned += quantity;
            return accumulator;
          },
          { issued: 0, purchased: 0, used: 0, returned: 0 },
        )
      : null;
  const painterPaymentTotal =
    businessType === "PAINTER"
      ? painterData.payments.reduce(
          (total, payment) => total + Number(payment.amount || 0),
          0,
        )
      : 0;
  const painterBalance =
    businessType === "PAINTER"
      ? painterData.paintBalances.reduce(
          (total, item) => total + Number(item.balance || 0),
          0,
        )
      : 0;
  const attendanceRows = analytics?.attendanceByDate || [];
  const paymentRows = analytics?.paymentsByDate || [];
  const dueRows = analytics?.dueByWorker || [];
  const exceptionRows = analytics?.exceptions || [];
  const attendanceSummary = attendanceRows.reduce(
    (accumulator, item) => {
      accumulator.working += item.present + item.doublePresent + item.halfDay;
      accumulator.present += item.present;
      accumulator.absent += item.absent;
      accumulator.leave += item.leave;
      return accumulator;
    },
    { working: 0, present: 0, absent: 0, leave: 0 },
  );
  const avgWorkingPerDay = attendanceRows.length
    ? attendanceSummary.working / attendanceRows.length
    : 0;
  const attendanceTrendValues = attendanceRows.map((item) => ({
    date: item.date,
    total:
      item.present +
      item.doublePresent +
      item.halfDay +
      item.absent +
      item.leave,
    present: item.present + item.doublePresent + item.halfDay,
  }));
  const selectedTrendPoint =
    selectedAttendancePoint && attendanceTrendValues.length
      ? attendanceTrendValues.find(
          (item) => item.date === selectedAttendancePoint.date,
        ) || attendanceTrendValues.at(-1)
      : attendanceTrendValues.at(-1) || null;
  const maxAttendanceTrend = Math.max(
    1,
    ...attendanceTrendValues.map((item) => Math.max(item.total, item.present)),
  );
  const attendanceTrendWidth = 560;
  const attendanceTrendHeight = 170;
  const attendanceTrendPadding = 18;
  const attendanceTrendAxisLeft = 34;
  const attendanceTrendAxisBottom = 18;
  const attendanceTrendChartHeight =
    attendanceTrendHeight - attendanceTrendAxisBottom - attendanceTrendPadding;
  const attendanceTrendTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = Math.round(maxAttendanceTrend * ratio);
    const y =
      attendanceTrendHeight -
      attendanceTrendAxisBottom -
      ratio * attendanceTrendChartHeight;
    return { ratio, value, y };
  });
  const getAttendanceTrendPoint = (item, index, key) => {
    const x =
      attendanceTrendValues.length === 1
        ? attendanceTrendWidth / 2
        : attendanceTrendAxisLeft +
          (index *
            (attendanceTrendWidth -
              attendanceTrendAxisLeft -
              attendanceTrendPadding)) /
            (attendanceTrendValues.length - 1);
    const y =
      attendanceTrendHeight -
      attendanceTrendAxisBottom -
      (item[key] / maxAttendanceTrend) * attendanceTrendChartHeight;
    return { x, y };
  };
  const attendanceTrendPath = (key) => {
    if (!attendanceTrendValues.length) return "";
    const points = attendanceTrendValues.map((item, index) => {
      const { x, y } = getAttendanceTrendPoint(item, index, key);
      return `${x},${y}`;
    });
    return points.join(" ");
  };
  const attendanceAreaPath = () => {
    if (!attendanceTrendValues.length) return "";
    const path = attendanceTrendValues.map((item, index) => {
      const { x, y } = getAttendanceTrendPoint(item, index, "present");
      return { x, y };
    });
    if (path.length === 0) return "";
    const first = path[0];
    const last = path[path.length - 1];
    const baselineY = attendanceTrendHeight - attendanceTrendAxisBottom;
    return `M ${first.x} ${baselineY} L ${path
      .map((point) => `${point.x} ${point.y}`)
      .join(" L ")} L ${last.x} ${baselineY} Z`;
  };
  const maxAttendance = Math.max(
    1,
    ...attendanceRows.map(
      (item) =>
        item.present +
        item.doublePresent +
        item.halfDay +
        item.absent +
        item.leave,
    ),
  );
  const maxMoney = Math.max(
    1,
    ...paymentRows.map((item) => item.paid),
    ...attendanceRows.map((item) => item.payable),
  );
  const maxDue = Math.max(1, ...dueRows.map((item) => item.due));
  const updateAnalyticsFilter = (field) => (event) =>
    setAnalyticsFilters((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  return (
    <>
      <PageHeader
        title="Overview"
        action={
          <Button
            icon={RefreshCcw}
            className={`${styles["button-secondary"]}`}
            onClick={() => {
              load();
              if (businessType === "LABOUR") loadAnalytics();
            }}
          >
            Refresh
          </Button>
        }
      />
      <ErrorNote error={error} />
      <Panel
        title="Operations dashboard"
        detail="Filter a period and workforce slice to inspect attendance, money and exceptions."
      >
        <div className={`${styles["toolbar"]} ${styles["filter-bar"]}`}>
          <Field label="From">
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
          <Field label="Worker">
            <select
              value={analyticsFilters.worker}
              onChange={updateAnalyticsFilter("worker")}
            >
              <option value="">All workers</option>
              {(analytics?.workers || []).map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </Field>
          {[
            ["companyName", "Company", "company"],
            ["teamName", "Team", "team"],
            ["workZone", "Location", "workZone"],
            ["skill", "Skill", "skill"],
          ].map(([field, label, compositionKey]) => (
            <Field label={label} key={field}>
              <select
                value={analyticsFilters[field]}
                onChange={updateAnalyticsFilter(field)}
              >
                <option value="">All {label.toLowerCase()}s</option>
                {Object.keys(
                  analytics?.composition?.[compositionKey] || {},
                ).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      </Panel>
      {analytics && (
        <>
          <div
            className={`${styles["metric-grid"]} ${styles["dashboard-metrics"]}`}
          >
            <Metric
              label="Attendance rate"
              value={`${analytics.kpis.attendanceRate}%`}
              detail={`${chartValue(analytics.kpis.present)} present entries`}
              tone="teal"
              icon={CalendarDays}
            />
            <Metric
              label="Period payable"
              value={money(analytics.kpis.payable)}
              detail={`${chartValue(analytics.kpis.overtimeHours)} OT hours`}
              tone="amber"
              icon={IndianRupee}
            />
            <Metric
              label="Period paid"
              value={money(analytics.kpis.paid)}
              detail="Payments in selected range"
              tone="blue"
              icon={Banknote}
            />
            <Metric
              label="Unmarked entries"
              value={chartValue(analytics.kpis.unmarked)}
              detail={`${chartValue(analytics.kpis.activeWorkers)} active workers`}
              tone="coral"
              icon={CalendarDays}
            />
          </div>
          <div className={`${styles["content-grid"]} ${styles["two-one"]}`}>
            <Panel
              title="Attendance trend"
              detail="Workers tracked vs present across the selected period."
            >
              <div className={`${styles["attendance-trend-summary"]}`}>
                <span>
                  <strong>
                    {attendanceRows.length
                      ? avgWorkingPerDay.toFixed(1)
                      : "0.0"}
                  </strong>
                  avg working / day
                </span>
                <span>
                  <strong>{chartValue(attendanceSummary.present)}</strong>
                  present
                </span>
                <span>
                  <strong>{chartValue(attendanceSummary.working)}</strong>
                  total tracked
                </span>
              </div>
              <div className={`${styles["attendance-trend-insight"]}`}>
                <span>Insight</span>
                <strong>
                  {selectedTrendPoint
                    ? `${new Date(`${selectedTrendPoint.date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} • ${selectedTrendPoint.present} present`
                    : "No attendance data"}
                </strong>
              </div>
              <div className={`${styles["chart-scroll"]}`}>
                {attendanceRows.length ? (
                  <div className={`${styles["attendance-trend-wrap"]}`}>
                    <svg
                      viewBox={`0 0 ${attendanceTrendWidth} ${attendanceTrendHeight}`}
                      preserveAspectRatio="none"
                      className={`${styles["attendance-trend-svg"]}`}
                    >
                      <defs>
                        <linearGradient
                          id="attendanceTrendFill"
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="rgba(86, 200, 181, 0.28)"
                          />
                          <stop
                            offset="100%"
                            stopColor="rgba(86, 200, 181, 0.03)"
                          />
                        </linearGradient>
                      </defs>
                      {attendanceTrendTicks.map((tick) => (
                        <g key={tick.ratio}>
                          <line
                            x1={attendanceTrendAxisLeft}
                            x2={attendanceTrendWidth - attendanceTrendPadding}
                            y1={tick.y}
                            y2={tick.y}
                            stroke="rgba(18, 61, 57, 0.08)"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={8}
                            y={tick.y + 3}
                            fill="rgba(18, 61, 57, 0.7)"
                            fontSize="9"
                            fontFamily="DM Sans, sans-serif"
                          >
                            {tick.value}
                          </text>
                        </g>
                      ))}
                      <path
                        d={attendanceAreaPath()}
                        fill="url(#attendanceTrendFill)"
                      />
                      <polyline
                        fill="none"
                        stroke="rgba(18, 61, 57, 0.18)"
                        strokeWidth="1.5"
                        points={attendanceTrendPath("total")}
                        strokeDasharray="4 6"
                      />
                      <polyline
                        fill="none"
                        stroke="#56c8b5"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={attendanceTrendPath("present")}
                      />
                      {attendanceTrendValues.map((item, index) => {
                        const { x, y } = getAttendanceTrendPoint(
                          item,
                          index,
                          "present",
                        );
                        const isActive = selectedTrendPoint?.date === item.date;
                        return (
                          <g
                            key={item.date}
                            onMouseEnter={() =>
                              setSelectedAttendancePoint(item)
                            }
                            onMouseLeave={() =>
                              setSelectedAttendancePoint(
                                attendanceTrendValues.at(-1) || null,
                              )
                            }
                            onFocus={() => setSelectedAttendancePoint(item)}
                            onBlur={() =>
                              setSelectedAttendancePoint(
                                attendanceTrendValues.at(-1) || null,
                              )
                            }
                            tabIndex={0}
                          >
                            <title>{`${new Date(`${item.date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} • ${item.present} present`}</title>
                            <circle
                              cx={x}
                              cy={y}
                              r={isActive ? 5.5 : 3.5}
                              fill={isActive ? "#123d39" : "#ffffff"}
                              stroke="#56c8b5"
                              strokeWidth={isActive ? 3 : 2}
                              style={{
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                              }}
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                ) : (
                  <Empty title="No attendance in this range" />
                )}
              </div>
              <div className={`${styles["chart-legend"]}`}>
                <span>
                  <i className={`${styles["chart-present"]}`} /> Present
                </span>
                <span>
                  <i className={`${styles["chart-absent"]}`} /> Total tracked
                </span>
              </div>
            </Panel>
            <Panel title="Payable vs paid" detail="Selected period totals.">
              <div className={`${styles["money-donut-wrap"]}`}>
                {(() => {
                  const payableTotal = Number(analytics.kpis.payable || 0);
                  const paidTotal = Number(analytics.kpis.paid || 0);
                  const totalMoney = payableTotal + paidTotal;
                  const payablePercent = totalMoney
                    ? (payableTotal / totalMoney) * 100
                    : 0;
                  const donutBackground = totalMoney
                    ? `conic-gradient(var(--amber) 0 ${payablePercent}%, var(--teal) ${payablePercent}% 100%)`
                    : "conic-gradient(#dfe9e7 0 100%)";

                  return (
                    <>
                      <div
                        className={`${styles["money-donut"]}`}
                        style={{ background: donutBackground }}
                      >
                        <div className={`${styles["money-donut-center"]}`}>
                          <strong>{money(totalMoney)}</strong>
                          <small>Total</small>
                        </div>
                      </div>
                      <div className={`${styles["money-donut-legend"]}`}>
                        <span>
                          <i className={`${styles["chart-payable"]}`} /> Payable
                          <strong>{money(payableTotal)}</strong>
                        </span>
                        <span>
                          <i className={`${styles["chart-paid"]}`} /> Paid
                          <strong>{money(paidTotal)}</strong>
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </Panel>
          </div>
          <div className={`${styles["content-grid"]} ${styles["two-one"]}`}>
            <Panel
              title="Workers with highest due"
              detail="Lifetime outstanding balances for the filtered workforce."
            >
              <div className={`${styles["rank-list"]}`}>
                {dueRows.length ? (
                  dueRows.map((item) => (
                    <div
                      className={`${styles["rank-row"]}`}
                      key={item.workerId}
                    >
                      <div>
                        <strong>{item.workerName}</strong>
                        <small>{money(item.due)} due</small>
                      </div>
                      <div className={`${styles["rank-track"]}`}>
                        <i style={{ width: `${(item.due / maxDue) * 100}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty title="No outstanding dues" />
                )}
              </div>
            </Panel>
            <Panel
              title="Attendance exceptions"
              detail="Workers needing attention in the selected period."
            >
              <div className={`${styles["exception-list"]}`}>
                {exceptionRows.length ? (
                  exceptionRows.map((item) => (
                    <div key={item.workerId}>
                      <strong>{item.workerName}</strong>
                      <small>
                        {item.notMarked} unmarked · {item.absent} absent ·{" "}
                        {item.leave} leave
                      </small>
                    </div>
                  ))
                ) : (
                  <Empty title="No exceptions" />
                )}
              </div>
            </Panel>
          </div>
        </>
      )}
      <div
        className={`${styles["metric-grid"]} ${styles["dashboard-metrics"]}`}
      >
        <Metric
          label={`${workspaceLabel} dues`}
          value={money(summary.dueToWorkers)}
          detail={`${money(summary.workerPaid)} paid out`}
          tone="coral"
          icon={ArrowUpRight}
        />
        <Metric
          label={`${workspaceLabel} working`}
          value={number(activePeople)}
          detail={`${money(payable)} payable`}
          icon={UsersRound}
        />
      </div>
      <div className={`${styles["quick-actions"]}`}>
        <button onClick={() => navigate(`/${workspace}/payments`)}>
          {" "}
          <Banknote size={18} />
          <span>
            <strong>
              {businessType === "PAINTER"
                ? "Record painter payment"
                : "Record labour payment"}
            </strong>
            <small>Add advance, wage or expense payment</small>
          </span>
        </button>
      </div>
      {businessType === "PAINTER" && (
        <div className={`${styles["content-grid"]} ${styles["two-one"]}`}>
          <Panel
            title="Painter-wise summary"
            detail="Live painter count, cash issued, and remaining paint in circulation."
          >
            <div className={`${styles["money-list"]}`}>
              <div>
                <span>Active painters</span>
                <strong>{number(painterSummary?.active || 0)}</strong>
              </div>
              <div>
                <span>Cash issued</span>
                <strong>{money(painterPaymentTotal)}</strong>
              </div>
              <div>
                <span>Paint issued</span>
                <strong>{number(paintSummary?.issued || 0)} L</strong>
              </div>
              <div>
                <span>Paint used</span>
                <strong>{number(paintSummary?.used || 0)} L</strong>
              </div>
              <div>
                <span>Current paint balance</span>
                <strong>{number(painterBalance)} L</strong>
              </div>
              <div>
                <span>Outstanding due</span>
                <strong>{money(painterSummary?.totalDue || 0)}</strong>
              </div>
            </div>
          </Panel>
          <Panel
            title="Painter ledger"
            detail="Quick view of each painter’s outstanding amount and paint availability."
          >
            <div className={`${styles["table-wrap"]}`}>
              <table>
                <thead>
                  <tr>
                    <th>Painter</th>
                    <th>Skill</th>
                    <th>Due</th>
                    <th>Paint balance</th>
                  </tr>
                </thead>
                <tbody>
                  {painterData.workers.length ? (
                    painterData.workers.map((worker) => {
                      const workerPaintBalance = painterData.paintTransactions
                        .filter((item) => item.worker?._id === worker._id)
                        .reduce((total, item) => {
                          const quantity = Number(item.quantity || 0);
                          if (item.kind === "ISSUED") total += quantity;
                          if (item.kind === "USED") total -= quantity;
                          if (item.kind === "RETURNED") total += quantity;
                          return total;
                        }, 0);
                      return (
                        <tr key={worker._id}>
                          <td>
                            <strong>{worker.name}</strong>
                            <small>
                              {worker.active ? "Active" : "Inactive"}
                            </small>
                          </td>
                          <td>{worker.skill || "Painter"}</td>
                          <td className={`${styles["amount"]}`}>
                            {money(worker.totalDue || 0)}
                          </td>
                          <td>{number(Math.max(workerPaintBalance, 0))} L</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4">
                        <Empty
                          title="No painter ledger yet"
                          detail="Add workers to start painter tracking."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
      <div className={`${styles["content-grid"]} ${styles["two-one"]}`}>
        <Panel
          title={
            businessType === "PAINTER"
              ? "Painter money snapshot"
              : "Labour money snapshot"
          }
          detail={
            businessType === "PAINTER"
              ? "All painter amounts are calculated from saved painting work, paint movement and payment records."
              : "All labour amounts are calculated from saved worker work, advance and payment records."
          }
        >
          <div className={`${styles["money-list"]}`}>
            <div>
              <span>
                {businessType === "PAINTER"
                  ? "Total painter cost"
                  : "Total labour cost"}
              </span>
              <strong>{money(summary.totalWorkerCost)}</strong>
            </div>
            <div>
              <span>Total expense paid</span>
              <strong>{money(summary.totalExpense)}</strong>
            </div>
            <div>
              <span>
                {businessType === "PAINTER"
                  ? "Advance with painters"
                  : "Advance with workers"}
              </span>
              <strong>{money(summary.advances)}</strong>
            </div>
          </div>
        </Panel>
        <Panel
          title={
            businessType === "PAINTER"
              ? "Painter payout summary"
              : "Labour payout summary"
          }
          detail={
            businessType === "PAINTER"
              ? "Track what has been paid to painters and their outstanding dues."
              : "Track what has been paid to labour workers and their outstanding dues."
          }
        >
          <div className={`${styles["money-list"]}`}>
            <div>
              <span>
                {businessType === "PAINTER"
                  ? "Paid to painters"
                  : "Paid to workers"}
              </span>
              <strong>{money(summary.workerPaid)}</strong>
            </div>
            <div>
              <span>
                {businessType === "PAINTER"
                  ? "Due to painters"
                  : "Due to workers"}
              </span>
              <strong>{money(summary.dueToWorkers)}</strong>
            </div>
            <div>
              <span>Advances</span>
              <strong>{money(summary.advances)}</strong>
            </div>
            <div>
              <span>Other expenses</span>
              <strong>{money(summary.totalExpense)}</strong>
            </div>
          </div>
        </Panel>
      </div>
      <div className={`${styles["content-grid"]} ${styles["two-one"]}`}>
        <Panel
          title="Recent transactions"
          detail="Latest money received and paid."
          action={
            <button
              className={`${styles["text-button"]}`}
              onClick={() => navigate(`/${workspace}/payments`)}
            >
              All payments
            </button>
          }
        >
          <div className={`${styles["compact-list"]}`}>
            {latestPayments.length ? (
              latestPayments.map((payment) => (
                <div key={payment._id}>
                  <span
                    className={`${styles["round-icon"]} ${styles[payment.flow === "INFLOW" ? "inflow" : "outflow"]}`}
                  >
                    {payment.flow === "INFLOW" ? (
                      <ArrowDownLeft size={16} />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {payment.worker?.name || "Business expense"}
                    </strong>
                    <small>
                      {payment.kind.replace("_", " ")} · {date(payment.paidOn)}
                    </small>
                  </div>
                  <strong
                    className={
                      styles[payment.flow === "INFLOW" ? "income" : "expense"]
                    }
                  >
                    {payment.flow === "INFLOW" ? "+" : "−"}
                    {money(payment.amount)}
                  </strong>
                </div>
              ))
            ) : (
              <Empty
                title="No transactions yet"
                detail="Payments and advances will appear here."
              />
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
