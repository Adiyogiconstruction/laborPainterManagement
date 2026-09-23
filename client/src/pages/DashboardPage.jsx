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
import {
  ErrorNote,
  Metric,
  SectionTabs,
  errorMessage,
  typeClass,
  typeTitle,
} from "./shared.jsx";

export function DashboardPage({ businessType = "LABOUR" }) {
  const workspace = businessType.toLowerCase();
  const navigate = useNavigate();
  const [data, setData] = useState();
  const [painterData, setPainterData] = useState({
    workers: [],
    paintTransactions: [],
    paintBalances: [],
    payments: [],
  });
  const [error, setError] = useState("");
  const load = () =>
    request(api.get("/dashboard/summary", { params: { type: businessType } }))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    load();
  }, [businessType]);
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
  return (
    <>
      <PageHeader
        title="Overview"
        action={
          <div className={`${styles["dashboard-header-actions"]}`}>
            <Button
              icon={BriefcaseBusiness}
              className={`${styles["button-primary"]}`}
              onClick={() => navigate(`/${workspace}/work`)}
            >
              {businessType === "PAINTER"
                ? "New painter work supply"
                : "New labour work supply"}
            </Button>
            <Button
              icon={RefreshCcw}
              className={`${styles["button-secondary"]}`}
              onClick={load}
            >
              Refresh
            </Button>
          </div>
        }
      />
      <ErrorNote error={error} />
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
          detail={`${money(payable)} payable · ${number(summary.activeAssignments)} active work records`}
          icon={UsersRound}
        />
      </div>
      <div className={`${styles["quick-actions"]}`}>
        <button
          className={`${styles["quick-primary"]}`}
          onClick={() => navigate(`/${workspace}/work`)}
        >
          {" "}
          <BriefcaseBusiness size={18} />
          <span>
            <strong>
              {businessType === "PAINTER"
                ? "New painter work supply"
                : "New labour work supply"}
            </strong>
            <small>Assign work to a client site</small>
          </span>
        </button>
        <button onClick={() => navigate(`/${workspace}/payments`)}>
          {" "}
          <Banknote size={18} />
          <span>
            <strong>
              {businessType === "PAINTER"
                ? "Record painter payment"
                : "Record labour payment"}
            </strong>
            <small>Add advance, wage or client receipt</small>
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
          title={
            businessType === "PAINTER"
              ? "Outstanding painter work records"
              : "Outstanding labour work records"
          }
          detail={
            businessType === "PAINTER"
              ? "Painting work that still has money due from the client or payable to the painter."
              : "Labour work that still has money due from the client or payable to the worker."
          }
          action={
            <button
              className={`${styles["text-button"]}`}
              onClick={() => navigate(`/${workspace}/work`)}
            >
              Work supply
            </button>
          }
        >
          <div className={`${styles["table-wrap"]}`}>
            <table>
              <thead>
                <tr>
                  <th>Worker / site</th>
                  <th>Type</th>
                  <th>Payable</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.length ? (
                  outstanding.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.worker}</strong>
                        <small>{item.siteName}</small>
                      </td>
                      <td>
                        <Status tone={typeClass(item.type)}>
                          {typeTitle(item.type)}
                        </Status>
                      </td>
                      <td className={`${styles["amount"]}`}>
                        {money(item.payableDue)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3">
                      <Empty
                        title="Everything is settled"
                        detail="No outstanding work records right now."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
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
                      {payment.client?.name ||
                        payment.worker?.name ||
                        "Business expense"}
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
