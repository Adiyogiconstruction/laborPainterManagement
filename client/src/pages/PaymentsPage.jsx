import styles from "../styles/design.module.css";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Landmark, Trash2 } from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { date, inputDate, money } from "../utils/formatters.js";
import {
  AddButton,
  Button,
  DeleteConfirm,
  Empty,
  Field,
  Modal,
  PageHeader,
  Panel,
  Status,
} from "../components/ui/index.jsx";
import { ErrorNote, Metric, errorMessage, typeTitle } from "./shared.jsx";

function PaymentForm({ businessType, onClose, onSaved }) {
  const [workers, setWorkers] = useState([]);
  const [workerSearch, setWorkerSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showWorkerResults, setShowWorkerResults] = useState(false);
  const [form, setForm] = useState({
    flow: "OUTFLOW",
    kind: "ADVANCE",
    amount: "",
    paidOn: inputDate(),
    worker: "",
    method: "CASH",
    reference: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    request(
      api.get("/workers", { params: { type: businessType, active: true } }),
    )
      .then(({ workers: result }) => setWorkers(result || []))
      .catch((err) => setError(errorMessage(err)));
  }, [businessType]);
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(workerSearch), 250);
    return () => clearTimeout(timer);
  }, [workerSearch]);
  const change = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });
  const filteredWorkers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...workers].sort((left, right) => {
      if (!query) return left.name.localeCompare(right.name);
      const leftName = left.name.toLowerCase();
      const rightName = right.name.toLowerCase();
      const leftRank = leftName.startsWith(query)
        ? 0
        : leftName.includes(query)
          ? 1
          : 2;
      const rightRank = rightName.startsWith(query)
        ? 0
        : rightName.includes(query)
          ? 1
          : 2;
      return leftRank - rightRank || leftName.localeCompare(rightName);
    });
  }, [workers, searchQuery]);
  const selectWorker = (worker) => {
    setForm({ ...form, worker: worker._id });
    setWorkerSearch(worker.name);
    setShowWorkerResults(false);
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!form.worker) {
        throw new Error("Please select a worker from the search results.");
      }
      const { payment } = await request(
        api.post("/payments", {
          ...form,
          amount: Number(form.amount),
          worker: form.worker || undefined,
        }),
      );
      onSaved(payment);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Record workforce payment" onClose={onClose} wide>
      <form
        className={`${styles["form-grid"]} ${styles["three-col"]}`}
        onSubmit={save}
      >
        <Field label="Money flow">
          <input value="Money paid to workforce" readOnly />
        </Field>
        <Field label="Payment type">
          <select value={form.kind} onChange={change("kind")}>
            <option value="ADVANCE">advance</option>
            <option value="EXPENSE">kharchi</option>
            <option value="TRAVEL_ADVANCE">advance for ticket</option>
            <option value="OTHER">other ( need to specify)</option>
          </select>
        </Field>
        <Field label="Amount">
          <input
            required
            min="1"
            step="0.01"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.amount}
            onChange={change("amount")}
            placeholder="₹ 0"
          />
        </Field>
        <Field label="Payment date">
          <input
            required
            type="date"
            value={form.paidOn}
            onChange={change("paidOn")}
          />
        </Field>
        <Field label="Payment method">
          <select value={form.method} onChange={change("method")}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK">Bank transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label={businessType === "PAINTER" ? "Painter" : "Worker"}>
          <div className={`${styles["worker-picker"]}`}>
            <input
              required
              value={workerSearch}
              onFocus={() => setShowWorkerResults(true)}
              onChange={(event) => {
                setWorkerSearch(event.target.value);
                setForm({ ...form, worker: "" });
                setShowWorkerResults(true);
              }}
              placeholder="Type worker name"
              role="combobox"
              aria-expanded={showWorkerResults}
              aria-controls="payment-worker-results"
            />
            {showWorkerResults && workerSearch.trim() && (
              <div
                className={`${styles["worker-picker-results"]}`}
                id="payment-worker-results"
              >
                {filteredWorkers.length ? (
                  filteredWorkers.slice(0, 8).map((worker) => (
                    <button
                      type="button"
                      key={worker._id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectWorker(worker)}
                    >
                      {worker.name}
                    </button>
                  ))
                ) : (
                  <span>No worker found</span>
                )}
              </div>
            )}
          </div>
        </Field>
        <Field label="Reference">
          <input
            value={form.reference}
            onChange={change("reference")}
            placeholder="Optional"
          />
        </Field>
        {form.kind === "OTHER" && (
          <Field label="Specify payment type">
            <input
              required
              value={form.notes}
              onChange={change("notes")}
              placeholder="e.g. Medical advance, tool allowance"
            />
          </Field>
        )}
        {form.kind !== "OTHER" && (
          <Field label="Notes">
            <input
              value={form.notes}
              onChange={change("notes")}
              placeholder="Optional description"
            />
          </Field>
        )}
        <div className={`${styles["modal-actions"]}`}>
          <ErrorNote error={error} />
          <Button
            type="button"
            className={`${styles["button-ghost"]}`}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className={`${styles["button-primary"]}`} loading={saving}>
            Save payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function PaymentsPage({ businessType = "LABOUR" }) {
  const [payments, setPayments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState();
  const [error, setError] = useState("");
  const load = () =>
    request(
      api.get("/payments", {
        params: {
          flow: "OUTFLOW",
          type: businessType,
          ...(selectedWorker ? { worker: selectedWorker } : {}),
        },
      }),
    )
      .then(({ payments: result }) => setPayments(result))
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    load();
  }, [businessType, selectedWorker]);
  useEffect(() => {
    if (businessType !== "PAINTER") return;
    request(api.get("/workers", { params: { type: businessType } }))
      .then(({ workers: result }) => setWorkers(result))
      .catch(() => setWorkers([]));
  }, [businessType]);
  const totalPaid = payments.reduce(
    (total, item) => total + Number(item.amount || 0),
    0,
  );
  const filteredWorkerName =
    workers.find((worker) => worker._id === selectedWorker)?.name ||
    "Selected painter";
  return (
    <>
      <PageHeader
        eyebrow={
          businessType === "PAINTER" ? "PAINTER PAYMENTS" : "LABOUR PAYMENTS"
        }
        title={
          businessType === "PAINTER"
            ? "Painter payment ledger"
            : "Labour payment ledger"
        }
        detail={
          businessType === "PAINTER"
            ? "Track painter cash advances, expenses and payout records separately from labour."
            : "Track labour wages, advances and payout records separately from painter work."
        }
        action={
          <AddButton
            className={`${styles["button-primary"]}`}
            onClick={() => setAdding(true)}
          >
            Record payment
          </AddButton>
        }
      />
      {businessType === "PAINTER" && (
        <Panel
          title="Painter ledger filter"
          detail="Select a painter to inspect that person’s cash ledger and payouts."
        >
          <div className={`${styles["toolbar"]}`}>
            <select
              value={selectedWorker}
              onChange={(event) => setSelectedWorker(event.target.value)}
            >
              <option value="">All painters</option>
              {workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </div>
        </Panel>
      )}
      <div className={`${styles["metric-grid"]} ${styles["compact-metrics"]}`}>
        <Metric
          label={
            businessType === "PAINTER"
              ? `${filteredWorkerName} cash paid`
              : "Total paid to workforce"
          }
          value={money(totalPaid)}
          detail={
            businessType === "PAINTER"
              ? "Painter payout ledger"
              : "Wages, advances and adjustments"
          }
          tone="coral"
          icon={ArrowUpRight}
        />
        <Metric
          label={
            businessType === "PAINTER"
              ? "Painter payment records"
              : "Labour payment records"
          }
          value={payments.length}
          detail={
            businessType === "PAINTER"
              ? "Visible painter entries"
              : "Visible labour payout entries"
          }
          tone="purple"
          icon={Landmark}
        />
      </div>
      <Panel>
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Worker</th>
                <th>Type</th>
                <th>Method</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment._id}>
                  <td>{date(payment.paidOn)}</td>
                  <td>
                    <strong>
                      {payment.worker?.name || "Business expense"}
                    </strong>
                    <small>{payment.notes || "Workforce payment"}</small>
                  </td>
                  <td>
                    <Status
                      tone={payment.kind === "ADVANCE" ? "amber" : "coral"}
                    >
                      {payment.kind.replace("_", " ")}
                    </Status>
                  </td>
                  <td>{payment.method}</td>
                  <td className={`${styles["amount"]} ${styles["expense"]}`}>
                    −{money(payment.amount)}
                  </td>
                  <td>
                    <button
                      className={`${styles["icon-button"]} ${styles["delete-button"]}`}
                      title="Delete payment"
                      onClick={() => setDeleting(payment)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!payments.length && (
                <tr>
                  <td colSpan="6">
                    <Empty
                      title={
                        businessType === "PAINTER"
                          ? "No painter payments"
                          : "No labour payments"
                      }
                      detail={
                        businessType === "PAINTER"
                          ? "Record painter advances, wages or expense payouts."
                          : "Record labour wages, advances or payout adjustments."
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {adding && (
        <PaymentForm
          businessType={businessType}
          onClose={() => setAdding(false)}
          onSaved={(payment) => {
            setAdding(false);
            setPayments((current) => [payment, ...current]);
          }}
        />
      )}
      {deleting && (
        <DeleteConfirm
          itemLabel={`payment of ${money(deleting.amount)}`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request(api.delete(`/payments/${deleting._id}`));
            setPayments((current) =>
              current.filter((item) => item._id !== deleting._id),
            );
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
