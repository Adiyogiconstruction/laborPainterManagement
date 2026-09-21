import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { inputDate, date, money } from "../utils/formatters.js";
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
import { ErrorNote, errorMessage } from "./shared.jsx";
import styles from "../styles/design.module.css";

function DprForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    date: inputDate(),
    siteName: "",
    floor: "",
    workDescription: "",
    quantity: 0,
    unit: "SQFT",
    status: "WORKING",
    paintPurchased: 0,
    paintUsed: 0,
    expenseAmount: 0,
    expenseCategory: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    request(api.get("/expense-categories"))
      .then(({ categories: result }) => setCategories(result))
      .catch(() => {});
  }, []);
  const change = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { entry } = await request(
        api.post("/daily-entries", {
          ...form,
          quantity: Number(form.quantity),
          paintPurchased: Number(form.paintPurchased),
          paintUsed: Number(form.paintUsed),
          expenseAmount: Number(form.expenseAmount),
        }),
      );
      onSaved(entry);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="New daily site entry" onClose={onClose} wide>
      <form
        className={`${styles["form-grid"]} ${styles["three-col"]}`}
        onSubmit={save}
      >
        <Field label="Date">
          <input
            required
            type="date"
            value={form.date}
            onChange={change("date")}
          />
        </Field>
        <Field label="Site / project">
          <input required value={form.siteName} onChange={change("siteName")} />
        </Field>
        <Field label="Floor">
          <input
            value={form.floor}
            onChange={change("floor")}
            placeholder="Ground / 1st / exterior"
          />
        </Field>
        <Field label="Work description">
          <input
            required
            value={form.workDescription}
            onChange={change("workDescription")}
          />
        </Field>
        <Field label="Quantity">
          <input
            min="0"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.quantity}
            onChange={change("quantity")}
          />
        </Field>
        <Field label="Unit">
          <input
            value={form.unit}
            onChange={change("unit")}
            placeholder="SQFT, ROOM, UNIT"
          />
        </Field>
        <Field label="Day status">
          <select value={form.status} onChange={change("status")}>
            <option value="WORKING">Site working</option>
            <option value="TRAVELLING">Travelling</option>
            <option value="NO_WORK">No work</option>
          </select>
        </Field>
        <Field label="Paint purchased">
          <input
            min="0"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.paintPurchased}
            onChange={change("paintPurchased")}
          />
        </Field>
        <Field label="Paint used">
          <input
            min="0"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.paintUsed}
            onChange={change("paintUsed")}
          />
        </Field>
        <Field label="Expense amount">
          <input
            min="0"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.expenseAmount}
            onChange={change("expenseAmount")}
          />
        </Field>
        <Field label="Expense category">
          <input
            list="expense-categories"
            value={form.expenseCategory}
            onChange={change("expenseCategory")}
            placeholder="Travel, food, hotel"
          />
          <datalist id="expense-categories">
            {categories.map((category) => (
              <option key={category._id} value={category.name} />
            ))}
          </datalist>
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
            Save DPR
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function DprPage() {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const load = () =>
    request(api.get("/daily-entries", { params: { siteName: search } }))
      .then(({ entries: result }) => setEntries(result))
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [search]);
  return (
    <>
      <PageHeader
        eyebrow="DAILY OPERATIONS"
        title="DPR / daily site entries"
        detail="Track floors, quantities, paint movement and site expenses in one daily record."
        action={
          <AddButton
            className={`${styles["button-primary"]}`}
            onClick={() => setAdding(true)}
          >
            New DPR entry
          </AddButton>
        }
      />
      <Panel
        action={
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search site…"
          />
        }
      >
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Site / floor</th>
                <th>Work</th>
                <th>Quantity</th>
                <th>Paint</th>
                <th>Expense</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry._id}>
                  <td>{date(entry.date)}</td>
                  <td>
                    <strong>{entry.siteName}</strong>
                    <small>{entry.floor || "All floors"}</small>
                  </td>
                  <td>{entry.workDescription}</td>
                  <td>
                    {entry.quantity} {entry.unit}
                  </td>
                  <td>
                    <small>Purchased {entry.paintPurchased}</small>
                    <small>Used {entry.paintUsed}</small>
                  </td>
                  <td>{money(entry.expenseAmount)}</td>
                  <td>
                    <Status
                      tone={entry.status === "WORKING" ? "teal" : "amber"}
                    >
                      {entry.status.replace("_", " ")}
                    </Status>
                  </td>
                  <td>
                    <button
                      className={`${styles["icon-button"]} ${styles["delete-button"]}`}
                      title="Delete DPR"
                      onClick={async () => {
                        await request(
                          api.delete(`/daily-entries/${entry._id}`),
                        );
                        setEntries((current) =>
                          current.filter((item) => item._id !== entry._id),
                        );
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!entries.length && (
                <tr>
                  <td colSpan="8">
                    <Empty
                      title="No DPR entries"
                      detail="Add the first daily site record."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {adding && (
        <DprForm
          onClose={() => setAdding(false)}
          onSaved={(entry) => {
            setAdding(false);
            setEntries((current) => [entry, ...current]);
          }}
        />
      )}
    </>
  );
}
