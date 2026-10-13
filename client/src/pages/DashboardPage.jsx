import styles from "../styles/design.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Clock3,
  IndianRupee,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
  Wallet,
} from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { subscribeToPaymentChanges } from "../utils/paymentEvents.js";
import { date, money } from "../utils/formatters.js";
import {
  Button,
  Empty,
  Field,
  PageHeader,
  Panel,
  SearchBox,
} from "../components/ui/index.jsx";
import { ErrorNote, Metric, errorMessage } from "./shared.jsx";

const localDateValue = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const monthStart = () => {
  const now = new Date();
  return localDateValue(new Date(now.getFullYear(), now.getMonth(), 1));
};

const today = () => localDateValue(new Date());

const dateRangeForPeriod = (period) => {
  const end = new Date();
  const start = new Date(end);
  if (period === "DAY") return [localDateValue(end), localDateValue(end)];
  if (period === "WEEK") start.setDate(end.getDate() - 6);
  if (period === "MONTH") start.setDate(1);
  if (period === "YEAR") start.setMonth(0, 1);
  return [localDateValue(start), localDateValue(end)];
};

const chartValue = (value) => Number(value || 0).toLocaleString("en-IN");
const dashboardRefreshIntervalMs = 60_000;

const compactMoney = (value) =>
  `₹${new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0))}`;

export function DashboardPage() {
  const businessType = "LABOUR";
  const navigate = useNavigate();
  const workspace = "labour";
  const [data, setData] = useState();
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [period, setPeriod] = useState("MONTH");
  const [analyticsFilters, setAnalyticsFilters] = useState({
    search: "",
    workerStatus: "ACTIVE",
    worker: "",
    companyName: "",
    teamName: "",
    workZone: "",
  });
  const [workerSearch, setWorkerSearch] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const refreshInProgress = useRef(false);
  const updateAnalyticsFilterValue = (field, value) =>
    setAnalyticsFilters((current) => ({
      ...current,
      [field]: value,
    }));
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setAnalyticsFilters((current) => ({
          ...current,
          search: workerSearch,
        })),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [workerSearch]);
  const load = useCallback(
    () =>
      request(api.get("/dashboard/summary", { params: { type: businessType } }))
        .then(setData),
    [businessType],
  );
  const loadAnalytics = useCallback(
    () =>
      request(
        api.get("/dashboard/analytics", {
          params: {
            from,
            to,
            period,
            type: businessType,
            ...Object.fromEntries(
              Object.entries(analyticsFilters).filter(([, value]) => value),
            ),
          },
        }),
      ).then(setAnalytics),
    [from, to, period, ...Object.values(analyticsFilters)],
  );
  useEffect(() => {
    const refresh = async () => {
      if (
        document.visibilityState !== "visible" ||
        refreshInProgress.current
      ) {
        return;
      }
      refreshInProgress.current = true;
      try {
        await Promise.all([load(), loadAnalytics()]);
        setError("");
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        refreshInProgress.current = false;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const unsubscribeFromPaymentChanges = subscribeToPaymentChanges(refresh);
    refresh();
    const intervalId = window.setInterval(refresh, dashboardRefreshIntervalMs);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      unsubscribeFromPaymentChanges();
      window.removeEventListener("focus", refresh);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [load, loadAnalytics]);
  const updatePeriod = (event) => {
    const nextPeriod = event.target.value;
    setPeriod(nextPeriod);
    if (nextPeriod === "ALL") {
      setFrom("");
      setTo("");
      return;
    }
    if (nextPeriod === "CUSTOM") return;
    const [start, end] = dateRangeForPeriod(nextPeriod);
    setFrom(start);
    setTo(end);
  };
  if (!data)
    return (
      <>
        <PageHeader
          className={styles["dashboard-page-header"]}
          title="Labour Operations Dashboard"
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
  const { latestPayments } = data;
  const attendanceRows = analytics?.attendanceByDate || [];
  const dueRows = analytics?.dueByWorker || [];
  const zoneRows = analytics?.zoneSummary || [];
  const zoneMaxLabour = Math.max(
    1,
    ...zoneRows.flatMap((item) => [
      item.labour,
      item.present,
      item.absent,
    ]),
  );
  const zoneMaxAttendance = 100;
  const zoneMaxPayable = Math.max(
    1,
    ...zoneRows.flatMap((item) => [item.payable, item.paid]),
  );
  const attendanceSummary = attendanceRows.reduce(
    (accumulator, item) => {
      accumulator.absent += item.absent;
      return accumulator;
    },
    { absent: 0 },
  );
  const updateAnalyticsFilter = (field) => (event) =>
    updateAnalyticsFilterValue(field, event.target.value);
  return (
    <>
      <PageHeader
        className={styles["dashboard-page-header"]}
        title="Labour Operations Dashboard"
      />
      <ErrorNote error={error} />
      <Panel
        className={`${styles["dashboard-filter-panel"]} ${mobileFiltersOpen ? styles["dashboard-filters-open"] : ""}`}
        title="Dashboard filters"
        detail="Search labour by name, mobile, company, team, zone, or skill, then refine by status and date."
      >
        <button
          type="button"
          className={styles["dashboard-filter-toggle"]}
          aria-expanded={mobileFiltersOpen}
          aria-controls="dashboard-filter-controls"
          onClick={() => setMobileFiltersOpen((open) => !open)}
        >
          {mobileFiltersOpen ? "Apply filters" : "Show dashboard filters"}
        </button>
        <div
          className={`${styles["toolbar"]} ${styles["filter-bar"]}`}
          id="dashboard-filter-controls"
        >
          <SearchBox
            value={workerSearch}
            onChange={setWorkerSearch}
            placeholder="Search name, mobile, company, team, zone, or skill"
            ariaLabel="Search labour by name, mobile, company, team, zone, or skill"
          />
          <Field label="Period">
            <select value={period} onChange={updatePeriod}>
              <option value="ALL">All time</option>
              <option value="DAY">Day</option>
              <option value="WEEK">Week</option>
              <option value="MONTH">Month</option>
              <option value="YEAR">Year</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </Field>
          <Field label="From">
            <input
              type="date"
              value={from}
              disabled={period === "ALL"}
              onChange={(event) => {
                setPeriod("CUSTOM");
                setFrom(event.target.value);
              }}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={to}
              disabled={period === "ALL"}
              onChange={(event) => {
                setPeriod("CUSTOM");
                setTo(event.target.value);
              }}
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
          <Field label="Labour status">
            <select
              value={analyticsFilters.workerStatus}
              onChange={(event) => {
                updateAnalyticsFilter("workerStatus")(event);
                updateAnalyticsFilterValue("worker", "");
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="WENT_HOME">Went Home</option>
              <option value="ALL">All statuses</option>
            </select>
          </Field>
          {[
            ["companyName", "Company", "companies", "company"],
            ["teamName", "Team", "teams", "team"],
            ["workZone", "Zone", "zones", "workZone"],
          ].map(([field, label, pluralLabel, compositionKey]) => (
            <Field label={label} key={field}>
              <select
                value={analyticsFilters[field]}
                onChange={updateAnalyticsFilter(field)}
              >
                <option value="">All {pluralLabel}</option>
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
            className={`${styles["metric-grid"]} ${styles["dashboard-metrics"]} ${styles["dashboard-metrics-primary"]}`}
          >
            <Metric
              label="Total labour"
              value={chartValue(
                analytics.kpis.activeWorkers +
                  analytics.kpis.inactiveWorkers +
                  analytics.kpis.wentHomeWorkers,
              )}
              detail="Profiles in current selection"
              tone="blue"
              className={styles["metric-dashboard-total"]}
              icon={UsersRound}
            />
            <Metric
              label="Active labour"
              value={chartValue(analytics.kpis.activeWorkers)}
              detail="In current selection"
              tone="teal"
              className={styles["metric-dashboard-active"]}
              icon={UserRoundCheck}
            />
            <Metric
              label="Inactive labour"
              value={chartValue(analytics.kpis.inactiveWorkers)}
              detail="In current selection"
              tone="coral"
              className={styles["metric-dashboard-inactive"]}
              icon={UserRoundX}
            />
            <Metric
              label="Went Home"
              value={chartValue(analytics.kpis.wentHomeWorkers)}
              detail="Not expected for attendance"
              tone="amber"
              className={styles["metric-dashboard-inactive"]}
              icon={UserRoundX}
            />
            <Metric
              label="Present"
              value={chartValue(analytics.kpis.present)}
              detail={`${analytics.kpis.attendanceRate}% attendance rate`}
              tone="teal"
              className={styles["metric-dashboard-present"]}
              icon={CalendarDays}
            />
            <Metric
              label="Absent"
              value={chartValue(attendanceSummary.absent)}
              detail="Selected period"
              tone="coral"
              className={styles["metric-dashboard-absent"]}
              icon={CalendarDays}
            />
            <Metric
              label="Unmarked"
              value={chartValue(analytics.kpis.unmarked)}
              detail="Attendance entries"
              tone="amber"
              className={styles["metric-dashboard-unmarked"]}
              icon={CalendarDays}
            />
            <Metric
              label="OT hours"
              value={chartValue(analytics.kpis.overtimeHours)}
              detail="Selected period"
              tone="purple"
              className={styles["metric-dashboard-overtime"]}
              icon={Clock3}
            />
            <Metric
              label="Period payable"
              value={money(analytics.kpis.payable)}
              detail="Attendance-based labour cost"
              tone="amber"
              className={styles["metric-dashboard-payable"]}
              icon={IndianRupee}
            />
          </div>
          <div
            className={`${styles["metric-grid"]} ${styles["dashboard-metrics"]} ${styles["dashboard-metrics-secondary"]}`}
          >
            <Metric
              label="Period paid out"
              value={money(analytics.kpis.paid)}
              detail="Net worker payments"
              tone="teal"
              className={styles["metric-dashboard-paid"]}
              icon={Banknote}
            />
            <Metric
              label="Labour due"
              value={money(analytics.kpis.lifetimeDue)}
              detail="Outstanding across selected workers"
              tone="coral"
              className={styles["metric-dashboard-due"]}
              icon={Wallet}
            />
          </div>
          <div className={`${styles["content-grid"]} ${styles["dashboard-zone-charts"]}`}>
            <Panel
              title="Zone-wise labour strength"
              detail="Total, present, and absent labour in each work zone."
            >
              <div className={styles["dashboard-vertical-chart"]}>
                {zoneRows.length ? (
                  <>
                    <div className={styles["dashboard-chart-legend"]}>
                      <span><i className={styles["dashboard-bar-total"]} /> Total</span>
                      <span><i className={styles["dashboard-bar-present"]} /> Present</span>
                      <span><i className={styles["dashboard-bar-absent"]} /> Absent</span>
                    </div>
                    <div className={styles["dashboard-chart-columns"]}>
                      {zoneRows.map((zone) => (
                        <div className={styles["dashboard-chart-column"]} key={zone.zone}>
                          <div className={styles["dashboard-chart-stage"]}>
                            {[
                              ["Total", zone.labour, "dashboard-bar-total"],
                              ["Present", zone.present, "dashboard-bar-present"],
                              ["Absent", zone.absent, "dashboard-bar-absent"],
                            ].map(([label, value, tone]) => {
                              const height = Math.min(
                                100,
                                (Number(value || 0) / zoneMaxLabour) * 100,
                              );
                              return (
                                <div
                                  className={styles["dashboard-chart-bar"]}
                                  key={label}
                                  title={`${zone.zone} · ${label}: ${chartValue(value)}`}
                                  style={{ "--bar-height": `${height}%` }}
                                >
                                  <span>{chartValue(value)}</span>
                                  <i className={styles[tone]} />
                                </div>
                              );
                            })}
                          </div>
                          <strong className={styles["dashboard-chart-label"]} title={zone.zone}>
                            {zone.zone}
                          </strong>
                          <small className={styles["dashboard-chart-detail"]}>
                            {chartValue(zone.unmarked)} unmarked
                          </small>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <Empty title="No zone labour in this selection" />
                )}
              </div>
            </Panel>
            <Panel
              title="Zone-wise attendance rate"
              detail="Percentage of expected labour days marked present in each zone."
            >
              <div className={styles["dashboard-vertical-chart"]}>
                {zoneRows.length ? (
                  <>
                    <div className={styles["dashboard-chart-legend"]}>
                      <span><i className={styles["dashboard-bar-rate"]} /> Attendance rate</span>
                    </div>
                    <div className={styles["dashboard-chart-columns"]}>
                      {zoneRows.map((zone) => {
                        const height = Math.min(
                          100,
                          (Number(zone.attendanceRate || 0) / zoneMaxAttendance) * 100,
                        );
                        return (
                          <div className={styles["dashboard-chart-column"]} key={zone.zone}>
                            <div className={styles["dashboard-chart-stage"]}>
                              <div
                                className={styles["dashboard-chart-bar"]}
                                title={`${zone.zone} · Attendance rate: ${zone.attendanceRate}%`}
                                style={{ "--bar-height": `${height}%` }}
                              >
                                <span>{zone.attendanceRate}%</span>
                                <i className={styles["dashboard-bar-rate"]} />
                              </div>
                            </div>
                            <strong className={styles["dashboard-chart-label"]} title={zone.zone}>
                              {zone.zone}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <Empty title="No zone attendance in this selection" />
                )}
              </div>
            </Panel>
            <Panel
              title="Payable vs paid by zone"
              detail="Attendance-based labour cost compared with net payments in each zone."
            >
              <div className={styles["dashboard-vertical-chart"]}>
                {zoneRows.length ? (
                  <>
                    <div className={styles["dashboard-chart-legend"]}>
                      <span><i className={styles["dashboard-bar-payable"]} /> Payable</span>
                      <span><i className={styles["dashboard-bar-paid"]} /> Paid</span>
                    </div>
                    <div className={styles["dashboard-chart-columns"]}>
                      {zoneRows.map((zone) => (
                        <div className={styles["dashboard-chart-column"]} key={zone.zone}>
                          <div className={styles["dashboard-chart-stage"]}>
                            {[
                              ["Payable", zone.payable, "dashboard-bar-payable"],
                              ["Paid", zone.paid, "dashboard-bar-paid"],
                            ].map(([label, value, tone]) => {
                              const height = Math.min(
                                100,
                                (Number(value || 0) / zoneMaxPayable) * 100,
                              );
                              return (
                                <div
                                  className={styles["dashboard-chart-bar"]}
                                  key={label}
                                  title={`${zone.zone} · ${label}: ${money(value)}`}
                                  style={{ "--bar-height": `${height}%` }}
                                >
                                  <span>{compactMoney(value)}</span>
                                  <i className={styles[tone]} />
                                </div>
                              );
                            })}
                          </div>
                          <strong className={styles["dashboard-chart-label"]} title={zone.zone}>
                            {zone.zone}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <Empty title="No zone payments in this selection" />
                )}
              </div>
            </Panel>
          </div>
        </>
      )}
      <div className={styles["dashboard-actions"]}>
        <Button
          icon={Banknote}
          className={styles["button-primary"]}
          onClick={() => navigate(`/${workspace}/payments`)}
        >
          Record labour payment
        </Button>
      </div>
      <div
        className={`${styles["content-grid"]} ${styles["dashboard-summary-grid"]} ${styles["dashboard-reference-summary"]}`}
      >
        <Panel
          title={
            <span className={styles["dashboard-panel-title"]}>
              <i className={styles["dashboard-panel-icon-money"]}>
                <IndianRupee size={14} />
              </i>
              Labour Money Summary
            </span>
          }
          detail="Selected-period payments and expenses; outstanding due is lifetime-based."
          className={styles["dashboard-money-panel"]}
        >
          <div className={styles["dashboard-money-cards"]}>
            {[
              ["Period Payable", analytics?.kpis?.payable || 0, "payable", IndianRupee],
              ["Paid to Workers", analytics?.kpis?.paid || 0, "paid", Banknote],
              ["Advances Issued", analytics?.kpis?.advancePaid || 0, "advance", ArrowUpRight],
              ["Lifetime Due", analytics?.kpis?.lifetimeDue || 0, "due", Wallet],
            ].map(([label, amount, tone, Icon]) => (
              <div className={styles[`dashboard-money-${tone}`]} key={label}>
                <Icon size={16} />
                <span>{label}</span>
                <strong>{money(amount)}</strong>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title={
            <span className={styles["dashboard-panel-title"]}>
              <i className={styles["dashboard-panel-icon-due"]}>
                <Wallet size={14} />
              </i>
              Highest Due Workers
            </span>
          }
          detail="Lifetime outstanding balances for selected workers."
          className={styles["dashboard-due-panel"]}
          action={
            <button
              className={styles["text-button"]}
              onClick={() => navigate(`/${workspace}/workers`)}
            >
              View all
            </button>
          }
        >
          <div className={styles["dashboard-ranked-dues"]}>
            {dueRows.length ? (
              dueRows.slice(0, 5).map((item, index) => (
                <div key={item.workerId}>
                  <span className={styles["dashboard-rank-number"]}>{index + 1}</span>
                  <strong>{item.workerName}</strong>
                  <small>{money(item.due)} due</small>
                </div>
              ))
            ) : (
              <Empty title="No outstanding dues" />
            )}
          </div>
        </Panel>
        <Panel
          title={
            <span className={styles["dashboard-panel-title"]}>
              <i className={styles["dashboard-panel-icon-expense"]}>
                <Banknote size={14} />
              </i>
              Expenses & Advances
            </span>
          }
          detail="Top categories for selected-period Kharchi, advances and other worker outflows."
          className={styles["dashboard-expense-panel"]}
          action={
            <button
              className={styles["text-button"]}
              onClick={() => navigate(`/${workspace}/payments`)}
            >
              View all
            </button>
          }
        >
          <div className={styles["dashboard-expense-list"]}>
            {analytics?.expenseBreakdown?.length ? (
              analytics.expenseBreakdown.map(({ label, amount }, index) => (
                <div className={styles["dashboard-expense-row"]} key={label}>
                  <span className={styles[`dashboard-expense-icon-${index % 4}`]}>
                    {label.slice(0, 1).toUpperCase()}
                  </span>
                  <strong>{label}</strong>
                  <b>{money(amount)}</b>
                </div>
              ))
            ) : (
              <Empty title="No expenses in this period" />
            )}
            <div className={styles["dashboard-expense-total"]}>
              <strong>Total Kharchi</strong>
              <b>{money(analytics?.kpis?.expenseTotal || 0)}</b>
            </div>
            <div className={styles["dashboard-expense-total"]}>
              <strong>Total Advances</strong>
              <b>{money(analytics?.kpis?.advancePaid || 0)}</b>
            </div>
            {!!analytics?.kpis?.otherOutflowTotal && (
              <div className={styles["dashboard-expense-total"]}>
                <strong>Other worker outflows</strong>
                <b>{money(analytics.kpis.otherOutflowTotal)}</b>
              </div>
            )}
          </div>
        </Panel>
        <Panel
          title={
            <span className={styles["dashboard-panel-title"]}>
              <i className={styles["dashboard-panel-icon-transactions"]}>
                <ArrowDownLeft size={14} />
              </i>
              Recent Transactions
            </span>
          }
          detail="Latest money received and paid."
          className={styles["dashboard-transactions-panel"]}
          action={
            <button
              className={`${styles["text-button"]}`}
              onClick={() => navigate(`/${workspace}/payments`)}
            >
              View all
            </button>
          }
        >
          <div className={`${styles["compact-list"]}`}>
            {latestPayments.length ? (
              latestPayments.slice(0, 5).map((payment) => (
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
      <Panel
        title={
          <span className={styles["dashboard-panel-title"]}>
            <i className={styles["dashboard-panel-icon-zone"]}>
              <UsersRound size={14} />
            </i>
            Zone Summary
          </span>
        }
        detail="Key metrics by zone for the selected period."
        className={styles["dashboard-zone-panel"]}
      >
        {analytics?.zoneSummary?.length ? (
          <div className={styles["dashboard-zone-table-wrap"]}>
            <table className={styles["dashboard-zone-table"]}>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Total Labour</th>
                  <th>Active</th>
                  <th>Inactive</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Unmarked</th>
                  <th>Attendance Rate</th>
                  <th>OT Hours</th>
                  <th>Payable</th>
                  <th>Paid</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {analytics.zoneSummary.map((zone) => (
                  <tr key={zone.zone}>
                    <th scope="row">{zone.zone}</th>
                    <td>{chartValue(zone.labour)}</td>
                    <td>{chartValue(zone.active)}</td>
                    <td>{chartValue(zone.inactive)}</td>
                    <td>{chartValue(zone.present)}</td>
                    <td>{chartValue(zone.absent)}</td>
                    <td>{chartValue(zone.unmarked)}</td>
                    <td>
                      <div className={styles["dashboard-zone-rate"]}>
                        <span>
                          <i style={{ width: `${Math.min(100, zone.attendanceRate)}%` }} />
                        </span>
                        <b>{zone.attendanceRate}%</b>
                      </div>
                    </td>
                    <td>{chartValue(zone.overtimeHours)}</td>
                    <td>{money(zone.payable)}</td>
                    <td>{money(zone.paid)}</td>
                    <td className={styles["dashboard-zone-due"]}>{money(zone.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No zone data in this selection" />
        )}
      </Panel>
    </>
  );
}
