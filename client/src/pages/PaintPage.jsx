import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { inputDate, date, number } from "../utils/formatters.js";
import {
  AddButton,
  Button,
  Empty,
  Field,
  Modal,
  PageHeader,
  Panel,
  Status,
} from "../components/ui/index.jsx";
import { ErrorNote, errorMessage } from "./shared.jsx";
import styles from "../styles/design.module.css";

function PaintForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    date: inputDate(),
    paintName: "",
    kind: "ISSUED",
    quantity: 0,
    unit: "LITRE",
    siteName: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const change = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { transaction } = await request(
        api.post("/paint", { ...form, quantity: Number(form.quantity) }),
      );
      onSaved(transaction);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Add paint movement" onClose={onClose}>
      <form className={`${styles["form-grid"]}`} onSubmit={save}>
        <Field label="Date">
          <input
            required
            type="date"
            value={form.date}
            onChange={change("date")}
          />
        </Field>
        <Field label="Paint name">
          <input
            required
            value={form.paintName}
            onChange={change("paintName")}
            placeholder="Asian Paints White"
          />
        </Field>
        <Field label="Movement">
          <select value={form.kind} onChange={change("kind")}>
            <option value="ISSUED">Issued to painter</option>
            <option value="PURCHASED">Purchased</option>
            <option value="USED">Used at site</option>
            <option value="RETURNED">Returned</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
        </Field>
        <Field label="Quantity">
          <input
            required
            min="0.01"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            step="0.01"
            value={form.quantity}
            onChange={change("quantity")}
          />
        </Field>
        <Field label="Unit">
          <input value={form.unit} onChange={change("unit")} />
        </Field>
        <Field label="Site">
          <input value={form.siteName} onChange={change("siteName")} />
        </Field>
        <Field label="Notes">
          <input value={form.notes} onChange={change("notes")} />
        </Field>
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
            Save movement
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function PaintPage() {
  const [data, setData] = useState({ transactions: [], balances: [] });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const load = () =>
    request(api.get("/paint"))
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <PageHeader
        eyebrow="PAINT LEDGER"
        title="Paint inventory & ledger"
        detail="See issued, purchased, used and returned paint with current balances."
        action={
          <AddButton
            className={`${styles["button-primary"]}`}
            onClick={() => setAdding(true)}
          >
            Add paint movement
          </AddButton>
        }
      />
      <ErrorNote error={error} />
      <div className={`${styles["metric-grid"]}`}>
        {data.balances.map((item) => (
          <article
            className={`${styles["metric"]} ${styles["metric-purple"]}`}
            key={`${item.paintName}-${item.unit}`}
          >
            <div className={`${styles["metric-top"]}`}>
              <span>{item.paintName}</span>
              <Plus size={18} />
            </div>
            <strong>
              {number(item.balance)} {item.unit}
            </strong>
            <small>
              Used {number(item.used)} · Issued {number(item.issued)}
            </small>
          </article>
        ))}
      </div>
      <Panel title="Movement history">
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Paint</th>
                <th>Movement</th>
                <th>Quantity</th>
                <th>Site</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((item) => (
                <tr key={item._id}>
                  <td>{date(item.date)}</td>
                  <td>{item.paintName}</td>
                  <td>
                    <Status tone={item.kind === "USED" ? "coral" : "teal"}>
                      {item.kind}
                    </Status>
                  </td>
                  <td>
                    {item.quantity} {item.unit}
                  </td>
                  <td>{item.siteName || "—"}</td>
                  <td>
                    <button
                      className={`${styles["icon-button"]} ${styles["delete-button"]}`}
                      title="Delete movement"
                      onClick={async () => {
                        await request(api.delete(`/paint/${item._id}`));
                        load();
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!data.transactions.length && (
                <tr>
                  <td colSpan="6">
                    <Empty
                      title="No paint movements"
                      detail="Add paint issued, purchased or used to start the ledger."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {adding && (
        <PaintForm
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </>
  );
}
