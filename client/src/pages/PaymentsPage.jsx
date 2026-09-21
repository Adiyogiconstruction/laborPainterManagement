import styles from "../styles/design.module.css";
import { useEffect, useState } from "react";
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

function PaymentForm({ onClose, onSaved }) {
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState({
    flow: "OUTFLOW",
    kind: "ADVANCE",
    amount: "",
    paidOn: inputDate(),
    worker: "",
    assignment: "",
    method: "CASH",
    reference: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    Promise.all([
      request(api.get("/workers", { params: { active: true } })),
      request(api.get("/assignments", { params: { status: "ACTIVE" } })),
    ])
      .then(([workerData, assignmentData]) => {
        setWorkers(workerData.workers);
        setAssignments(assignmentData.assignments);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);
  const change = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });
  const useAssignment = (id) => {
    const assignment = assignments.find((item) => item._id === id);
    setForm({
      ...form,
      assignment: id,
      worker: assignment?.worker?._id || form.worker,
    });
  };
  const selectedWorker = workers.find((worker) => worker._id === form.worker);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { payment } = await request(
        api.post("/payments", {
          ...form,
          amount: Number(form.amount),
          worker: form.worker || undefined,
          assignment: form.assignment || undefined,
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
        <Field label="Worker">
          <select
            required={form.kind !== "EXPENSE"}
            value={form.worker}
            onChange={change("worker")}
          >
            <option value="">
              {form.kind === "EXPENSE" ? "Optional worker" : "Select worker"}
            </option>
            {workers.map((worker) => (
              <option key={worker._id} value={worker._id}>
                {worker.name} · {typeTitle(worker.type)} · Due{" "}
                {money(worker.totalDue)}
              </option>
            ))}
          </select>
          {selectedWorker && (
            <small>Current due: {money(selectedWorker.totalDue)}</small>
          )}
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
        <Field label="Work record">
          <select
            value={form.assignment}
            onChange={(event) => useAssignment(event.target.value)}
          >
            <option value="">No linked work</option>
            {assignments.map((assignment) => (
              <option key={assignment._id} value={assignment._id}>
                {assignment.siteName} ·{" "}
                {assignment.worker?.name || "Unassigned"}
              </option>
            ))}
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

export function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState();
  const [error, setError] = useState("");
  const load = () =>
    request(api.get("/payments", { params: { flow: "OUTFLOW" } }))
      .then(({ payments: result }) => setPayments(result))
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    load();
  }, []);
  const totalPaid = payments.reduce(
    (total, item) => total + Number(item.amount || 0),
    0,
  );
  return (
    <>
      <PageHeader
        eyebrow="WORKFORCE PAYMENTS"
        title="Labour & painter payouts"
        detail="Track exactly how much was paid to each labour worker and painter."
        action={
          <AddButton
            className={`${styles["button-primary"]}`}
            onClick={() => setAdding(true)}
          >
            Record payment
          </AddButton>
        }
      />
      <div className={`${styles["metric-grid"]} ${styles["compact-metrics"]}`}>
        <Metric
          label="Total paid to workforce"
          value={money(totalPaid)}
          detail="Wages, advances and adjustments"
          tone="coral"
          icon={ArrowUpRight}
        />
        <Metric
          label="Payment records"
          value={payments.length}
          detail="Visible payout entries"
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
                <th>Worker / category</th>
                <th>Type</th>
                <th>Work record</th>
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
                    <small>
                      {payment.worker
                        ? typeTitle(payment.worker.type)
                        : payment.notes || "Expense"}
                    </small>
                  </td>
                  <td>
                    <Status
                      tone={payment.kind === "ADVANCE" ? "amber" : "coral"}
                    >
                      {payment.kind.replace("_", " ")}
                    </Status>
                  </td>
                  <td>{payment.assignment?.siteName || "—"}</td>
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
                  <td colSpan="7">
                    <Empty
                      title="No workforce payments"
                      detail="Record wages or advances for a labour worker or painter."
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
