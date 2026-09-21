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
  Trash2,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { date, inputDate, money, number } from "../utils/formatters.js";
import {
  AddButton,
  Button,
  DeleteConfirm,
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

function AssignmentForm({ type, initial, onClose, onSaved }) {
  const [clients, setClients] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(
    initial
      ? {
          ...initial,
          client: initial.client?._id || initial.client,
          workers:
            initial.workers?.map((worker) => worker._id || worker) ||
            (initial.worker ? [initial.worker?._id || initial.worker] : []),
          startDate: inputDate(initial.startDate),
        }
      : {
          type,
          client: "",
          workers: [],
          siteName: "",
          workDescription: "",
          startDate: inputDate(),
          headCount: 1,
          workDays: 1,
          clientRate: "",
          workerRate: "",
          unit: "DAY",
          billingAmount: "",
          payoutAmount: "",
          status: "ACTIVE",
          notes: "",
        },
  );
  useEffect(() => {
    Promise.all([
      request(api.get("/clients", { params: { active: true } })),
      request(api.get("/workers", { params: { active: true, type } })),
    ])
      .then(([clientData, workerData]) => {
        setClients(clientData.clients);
        setWorkers(workerData.workers);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [type]);
  const change = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });
  const toggleWorker = (workerId) =>
    setForm({
      ...form,
      workers: form.workers.includes(workerId)
        ? form.workers.filter((id) => id !== workerId)
        : [...form.workers, workerId],
    });
  const calculated = useMemo(() => {
    const people = Number(form.headCount || 0);
    const days = Number(form.workDays || 0);
    const clientMultiplier = form.unit === "DAY" ? people * days : 1;
    const workerMultiplier =
      form.unit === "DAY" ? people * days : form.unit === "JOB" ? people : 1;
    return {
      client: Number(form.clientRate || 0) * clientMultiplier,
      worker: Number(form.workerRate || 0) * workerMultiplier,
    };
  }, [form]);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        headCount: Number(form.headCount),
        workDays: Number(form.workDays),
        clientRate: Number(form.clientRate || 0),
        workerRate: Number(form.workerRate || 0),
        billingAmount: calculated.client,
        payoutAmount: calculated.worker,
      };
      const data = initial
        ? await request(api.patch(`/assignments/${initial._id}`, payload))
        : await request(api.post("/assignments", payload));
      onSaved(data.assignment);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const chosenClient = clients.find((client) => client._id === form.client);
  return (
    <Modal
      title={`${initial ? "Edit" : "New"} work supply`}
      onClose={onClose}
      wide
    >
      <form
        className={`${styles["form-grid"]} ${styles["three-col"]}`}
        onSubmit={save}
      >
        <Field label="Supply type">
          <select value={form.type} onChange={change("type")}>
            <option value="LABOUR">Labour supply</option>
            <option value="PAINTER">Painter supply</option>
          </select>
        </Field>
        <Field label="Client">
          <select
            required
            value={form.client}
            onChange={(event) => {
              const client = clients.find(
                (item) => item._id === event.target.value,
              );
              setForm({
                ...form,
                client: event.target.value,
                siteName: client?.sites?.[0]?.name || form.siteName,
              });
            }}
          >
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client._id} value={client._id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Worker">
          <div className={`${styles["worker-checkboxes"]}`}>
            {workers.map((worker) => (
              <label key={worker._id}>
                <input
                  type="checkbox"
                  checked={form.workers.includes(worker._id)}
                  onChange={() => toggleWorker(worker._id)}
                />
                <span>
                  {worker.name} · {worker.skill || typeTitle(worker.type)}
                </span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Site / project">
          <input
            required
            list="client-sites"
            value={form.siteName}
            onChange={change("siteName")}
            placeholder="Project site name"
          />
          <datalist id="client-sites">
            {chosenClient?.sites?.map((site) => (
              <option key={site._id || site.name} value={site.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Work description">
          <input
            required
            value={form.workDescription}
            onChange={change("workDescription")}
            placeholder="e.g. Tiles loading, wall painting"
          />
        </Field>
        <Field label="Work status">
          <select value={form.status} onChange={change("status")}>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On hold</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </Field>
        <Field label="Start date">
          <input
            required
            type="date"
            value={form.startDate}
            onChange={change("startDate")}
          />
        </Field>
        <Field label="Rate unit">
          <select value={form.unit} onChange={change("unit")}>
            <option value="DAY">Per day</option>
            <option value="JOB">Per job</option>
            <option value="SQFT">Per sq. ft.</option>
            <option value="LUMPSUM">Lump sum</option>
          </select>
        </Field>
        <Field label="People supplied">
          <input
            required
            min="1"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.headCount}
            onChange={change("headCount")}
          />
        </Field>
        <Field label="Work days">
          <input
            required
            min="0"
            step="0.5"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.workDays}
            onChange={change("workDays")}
          />
        </Field>
        <Field
          label="Client billing rate"
          hint="Required: rate entered by user"
        >
          <input
            required
            min="0"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.clientRate}
            onChange={change("clientRate")}
            placeholder="₹ rate"
          />
        </Field>
        <Field label="Worker payout rate" hint="Required: rate entered by user">
          <input
            required
            min="0"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.workerRate}
            onChange={change("workerRate")}
            placeholder="₹ rate"
          />
        </Field>
        <Field
          label="Billing amount"
          hint={`Fixed client amount: ${money(calculated.client)}`}
        >
          <input
            min="0"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={calculated.client}
            disabled
            readOnly
            aria-label="Calculated billing amount"
          />
        </Field>
        <Field
          label="Payout amount"
          hint={`Worker total for ${form.headCount || 0} people: ${money(calculated.worker)}`}
        >
          <input
            min="0"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={calculated.worker}
            disabled
            readOnly
            aria-label="Calculated payout amount"
          />
        </Field>
        <Field label="Notes">
          <input
            value={form.notes || ""}
            onChange={change("notes")}
            placeholder="Optional notes"
          />
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
            {initial ? "Save changes" : "Create work record"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AssignmentsPage() {
  const [type, setType] = useState("LABOUR");
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState();
  const [deleting, setDeleting] = useState();
  const [error, setError] = useState("");
  const load = () =>
    request(api.get("/assignments", { params: { type, status, search } }))
      .then(({ assignments }) => setRecords(assignments))
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [type, status, search]);
  const save = (record) => {
    setAdding(false);
    setEditing(null);
    setRecords((current) =>
      current.some((item) => item._id === record._id)
        ? current.map((item) => (item._id === record._id ? record : item))
        : [record, ...current],
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="DAILY OPERATIONS"
        title="Work supply records"
        detail="Track how many people were supplied, where they worked, and the exact money involved."
        action={
          <AddButton
            className={`${styles["button-primary"]}`}
            onClick={() => setAdding(true)}
          >
            New work supply
          </AddButton>
        }
      />
      <div className={`${styles["toolbar"]}`}>
        <SectionTabs value={type} onChange={setType} />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="ON_HOLD">On hold</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search site or work…"
        />
      </div>
      <Panel>
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Supply & work</th>
                <th>Client / site</th>
                <th>People</th>
                <th>Period</th>
                <th>Client bill</th>
                <th>Worker cost</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id}>
                  <td>
                    <strong>{typeTitle(record.type)} supply</strong>
                    <small>
                      {record.workDescription}
                      {(record.workers?.length || record.worker) && " · "}
                      {record.workers?.length
                        ? record.workers.map((worker) => worker.name).join(", ")
                        : record.worker?.name || ""}
                    </small>
                  </td>
                  <td>
                    <strong>{record.client?.name}</strong>
                    <small>{record.siteName}</small>
                  </td>
                  <td>
                    {number(record.headCount)} × {number(record.workDays)} day
                  </td>
                  <td>{date(record.startDate)}</td>
                  <td className={`${styles["amount"]} ${styles["income"]}`}>
                    {money(record.billingAmount)}
                  </td>
                  <td className={`${styles["amount"]}`}>
                    {money(record.payoutAmount)}
                  </td>
                  <td>
                    <Status
                      tone={
                        record.status === "ACTIVE"
                          ? typeClass(record.type)
                          : record.status === "COMPLETED"
                            ? "teal"
                            : "neutral"
                      }
                    >
                      {record.status.replace("_", " ")}
                    </Status>
                  </td>
                  <td className={`${styles["actions"]}`}>
                    <button
                      className={`${styles["icon-button"]}`}
                      title="Edit record"
                      onClick={() => setEditing(record)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className={`${styles["icon-button"]} ${styles["delete-button"]}`}
                      title="Delete work record"
                      onClick={() => setDeleting(record)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan="8">
                    <Empty
                      title="No work supply records"
                      detail="Create a work record when people are supplied to a client."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {adding && (
        <AssignmentForm
          type={type}
          onClose={() => setAdding(false)}
          onSaved={save}
        />
      )}{" "}
      {editing && (
        <AssignmentForm
          type={type}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={save}
        />
      )}
      {deleting && (
        <DeleteConfirm
          itemLabel={`work record for ${deleting.worker?.name || "worker"}`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request(api.delete(`/assignments/${deleting._id}`));
            setRecords((current) =>
              current.filter((item) => item._id !== deleting._id),
            );
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
