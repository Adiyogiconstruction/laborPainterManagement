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

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState();
  const [error, setError] = useState("");
  const load = () =>
    request(api.get("/dashboard/summary"))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    load();
  }, []);
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
  return (
    <>
      <PageHeader
        eyebrow="BUSINESS OVERVIEW"
        title="Your operations, at a glance"
        detail="Live totals from every labour and painter work record."
        action={
          <div className={`${styles["dashboard-header-actions"]}`}>
            <Button
              icon={BriefcaseBusiness}
              className={`${styles["button-primary"]}`}
              onClick={() => navigate("/work")}
            >
              New work supply
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
          label="Worker dues"
          value={money(summary.dueToWorkers)}
          detail={`${money(summary.workerPaid)} paid out`}
          tone="coral"
          icon={ArrowUpRight}
        />
        <Metric
          label="Labour working"
          value={number(summary.activeLabour)}
          detail={`${money(summary.labourPayable)} payable · ${number(summary.activeAssignments)} active work records`}
          icon={UsersRound}
        />
        <Metric
          label="Painters active"
          value={number(summary.activePainters)}
          detail={`${money(summary.painterPayable)} payable · Available in your workforce`}
          tone="purple"
          icon={BriefcaseBusiness}
        />
      </div>
      <div className={`${styles["quick-actions"]}`}>
        <button
          className={`${styles["quick-primary"]}`}
          onClick={() => navigate("/work")}
        >
          {" "}
          <BriefcaseBusiness size={18} />
          <span>
            <strong>New work supply</strong>
            <small>Assign labour or painter to a client</small>
          </span>
        </button>
        <button onClick={() => navigate("/payments")}>
          {" "}
          <Banknote size={18} />
          <span>
            <strong>Record payment</strong>
            <small>Add advance, wage or client receipt</small>
          </span>
        </button>
      </div>
      <div className={`${styles["content-grid"]} ${styles["two-one"]}`}>
        <Panel
          title="Money snapshot"
          detail="All amounts are calculated from your saved work and payment records."
        >
          <div className={`${styles["money-list"]}`}>
            <div>
              <span>Total worker cost</span>
              <strong>{money(summary.totalWorkerCost)}</strong>
            </div>
            <div>
              <span>Total expense paid</span>
              <strong>{money(summary.totalExpense)}</strong>
            </div>
            <div>
              <span>Advance with workers</span>
              <strong>{money(summary.advances)}</strong>
            </div>
          </div>
        </Panel>
        <Panel
          title="Workforce payout summary"
          detail="Track what has been paid to labour and painters."
        >
          <div className={`${styles["money-list"]}`}>
            <div>
              <span>Paid to workers</span>
              <strong>{money(summary.workerPaid)}</strong>
            </div>
            <div>
              <span>Due to workers</span>
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
          title="Outstanding work records"
          detail="Work that still has money due from the client or payable to the worker."
          action={
            <button
              className={`${styles["text-button"]}`}
              onClick={() => navigate("/work")}
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
              onClick={() => navigate("/payments")}
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
