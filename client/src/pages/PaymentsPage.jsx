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
  const selectedWorker = workers.find((worker) => worker._id === form.worker);
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
              placeholder="Search and select worker"
              role="combobox"
              aria-expanded={showWorkerResults}
              aria-controls="payment-worker-results"
            />
            {selectedWorker && (
              <div className={`${styles["payment-worker-due"]}`}>
                <strong>
                  Current due: {money(selectedWorker.totalDue || 0)}
                </strong>
                <small>
                  Payable {money(selectedWorker.totalPayable || 0)} · Paid{" "}
                  {money(selectedWorker.totalPaid || 0)}
                </small>
              </div>
            )}
            {showWorkerResults && (
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
                      <strong>{worker.name}</strong>
                      <small>Due: {money(worker.totalDue || 0)}</small>
                    </button>
                  ))
                ) : (
                  <span>No worker found</span>
                )}
              </div>
            )}
          </div>
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
  const [kindFilter, setKindFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState();
  const [deletedPayments, setDeletedPayments] = useState([]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [error, setError] = useState("");
  const loadWorkers = () =>
    request(api.get("/workers", { params: { type: businessType } }))
      .then(({ workers: result }) => setWorkers(result || []))
      .catch((err) => setError(errorMessage(err)));
  const load = () =>
    request(
      api.get("/payments", {
        params: {
          flow: "OUTFLOW",
          type: businessType,
          ...(selectedWorker ? { worker: selectedWorker } : {}),
          ...(kindFilter ? { kind: kindFilter } : {}),
          ...(methodFilter ? { method: methodFilter } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
    )
      .then(({ payments: result }) => setPayments(result))
      .catch((err) => setError(errorMessage(err)));
  const loadDeletedPayments = () =>
    request(api.get("/payments/deleted"))
      .then(({ payments: result }) => setDeletedPayments(result || []))
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    loadWorkers();
  }, [businessType]);
  useEffect(() => {
    load();
  }, [businessType, selectedWorker, kindFilter, methodFilter, from, to]);
  const balanceWorkers = selectedWorker
    ? workers.filter((worker) => worker._id === selectedWorker)
    : workers;
  const totalPayable = balanceWorkers.reduce(
    (total, worker) => total + Number(worker.totalPayable || 0),
    0,
  );
  const totalWorkerPaid = balanceWorkers.reduce(
    (total, worker) => total + Number(worker.totalPaid || 0),
    0,
  );
  const totalDue = balanceWorkers.reduce(
    (total, worker) => total + Number(worker.totalDue || 0),
    0,
  );
  const extraPaid = balanceWorkers.reduce(
    (total, worker) => total + Number(worker.overpaid || 0),
    0,
  );
  const selectedWorkerName =
    workers.find((worker) => worker._id === selectedWorker)?.name ||
    (businessType === "PAINTER" ? "All painters" : "All workers");
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
          <div className={`${styles["actions-inline"]}`}>
            <Button
              className={`${styles["button-secondary"]}`}
              onClick={() => {
                setShowRecycleBin((current) => !current);
                if (!showRecycleBin) loadDeletedPayments();
              }}
              icon={Trash2}
            >
              Recycle bin
            </Button>
            <AddButton
              className={`${styles["button-primary"]}`}
              onClick={() => setAdding(true)}
            >
              Record payment
            </AddButton>
          </div>
        }
      />
      <Panel
        title="Payment filters"
        detail="Filter the ledger and inspect the selected worker's balance."
      >
        <div className={`${styles["toolbar"]} ${styles["filter-bar"]}`}>
          <Field label={businessType === "PAINTER" ? "Painter" : "Worker"}>
            <select
              value={selectedWorker}
              onChange={(event) => setSelectedWorker(event.target.value)}
            >
              <option value="">All workers</option>
              {workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment type">
            <select
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value)}
            >
              <option value="">All types</option>
              <option value="WAGE">Wage</option>
              <option value="ADVANCE">Advance</option>
              <option value="TRAVEL_ADVANCE">Advance for ticket</option>
              <option value="EXPENSE">Kharchi</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Payment method">
            <select
              value={methodFilter}
              onChange={(event) => setMethodFilter(event.target.value)}
            >
              <option value="">All methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK">Bank transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
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
          <Button
            className={`${styles["button-ghost"]}`}
            onClick={() => {
              setSelectedWorker("");
              setKindFilter("");
              setMethodFilter("");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </Button>
        </div>
      </Panel>
      {showRecycleBin && (
        <Panel
          title="Recycle bin"
          detail="Deleted payment records stay here until you restore them."
        >
          <div className={`${styles["table-wrap"]}`}>
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Deleted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {deletedPayments.length ? (
                  deletedPayments.map((payment) => (
                    <tr key={payment._id}>
                      <td>{payment.worker?.name || "Business expense"}</td>
                      <td>{payment.kind}</td>
                      <td className={`${styles["amount"]}`}>
                        {money(payment.amount)}
                      </td>
                      <td>{date(payment.deletedAt)}</td>
                      <td>
                        <Button
                          className={`${styles["button-secondary"]}`}
                          onClick={async () => {
                            await request(
                              api.patch(`/payments/${payment._id}/restore`),
                            );
                            await Promise.all([
                              load(),
                              loadDeletedPayments(),
                              loadWorkers(),
                            ]);
                          }}
                        >
                          Restore
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">
                      <Empty
                        title="Recycle bin empty"
                        detail="No deleted payment records yet."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <div className={`${styles["metric-grid"]} ${styles["compact-metrics"]}`}>
        <Metric
          label={`${selectedWorkerName} total payable`}
          value={money(totalPayable)}
          detail="Attendance and payable total"
          tone="teal"
          icon={ArrowUpRight}
        />
        <Metric
          label="Total paid"
          value={money(totalWorkerPaid)}
          detail={`${payments.length} filtered payment records`}
          tone="coral"
          icon={Landmark}
        />
        <Metric
          label="Payment due"
          value={money(totalDue)}
          detail="Amount still payable"
          tone="amber"
          icon={Landmark}
        />
        <Metric
          label="Extra paid"
          value={money(extraPaid)}
          detail="Paid above payable total"
          tone="purple"
          icon={ArrowUpRight}
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
          onSaved={async () => {
            setAdding(false);
            await Promise.all([load(), loadWorkers()]);
          }}
        />
      )}
      {deleting && (
        <DeleteConfirm
          itemLabel={`payment of ${money(deleting.amount)}`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request(api.delete(`/payments/${deleting._id}`));
            await Promise.all([load(), loadWorkers()]);
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
