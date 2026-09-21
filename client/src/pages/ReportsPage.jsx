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

export function ReportsPage() {
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState();
  const [error, setError] = useState("");
  const load = () =>
    request(api.get("/reports/operations", { params: { type, from, to } }))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
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
    <>
      <PageHeader
        eyebrow="ANALYTICS & RECORDS"
        title="Operations reports"
        detail="Filter your work and money movements by period or business module."
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
          <Field label="Supply module">
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="">Labour & painter</option>
              <option value="LABOUR">Labour only</option>
              <option value="PAINTER">Painter only</option>
            </select>
          </Field>
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
          <Button icon={RefreshCcw} className={`${styles["button-primary"]}`} onClick={load}>
            Apply filters
          </Button>
        </div>
        <ErrorNote error={error} />
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
        title="Work supply report"
        detail="Every saved labour and painter assignment in the selected period."
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
                  <td className={`${styles["amount"]}`}>{money(record.payoutAmount)}</td>
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
    </>
  );
}
