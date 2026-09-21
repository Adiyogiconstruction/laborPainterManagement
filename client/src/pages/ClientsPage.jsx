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

function ClientForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial
      ? {
          ...initial,
          siteNames: initial.sites?.map((site) => site.name).join(", ") || "",
        }
      : {
          name: "",
          contactPerson: "",
          phone: "",
          identityType: "AADHAAR",
          identityNumber: "",
          gstin: "",
          panNumber: "",
          placeOfSupply: "",
          billingAddress: "",
          siteNames: "",
          notes: "",
        },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { siteNames, ...rest } = form;
      const body = {
        ...rest,
        sites: siteNames
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
      };
      const data = initial
        ? await request(api.patch(`/clients/${initial._id}`, body))
        : await request(api.post("/clients", body));
      onSaved(data.client);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`${initial ? "Edit" : "Add"} client`} onClose={onClose}>
      <form onSubmit={save} className={`${styles["form-grid"]}`}>
        <Field label="Company / client name">
          <input
            required
            autoFocus
            value={form.name}
            onChange={change("name")}
            placeholder="e.g. ABC Constructions"
          />
        </Field>
        <Field label="Contact person">
          <input
            value={form.contactPerson || ""}
            onChange={change("contactPerson")}
            placeholder="Optional"
          />
        </Field>
        <Field label="Phone" hint="Required">
          <input
            required
            value={form.phone || ""}
            onChange={change("phone")}
            placeholder="Client phone number"
          />
        </Field>
        <Field label="Identity document">
          <select
            required
            value={form.identityType || "AADHAAR"}
            onChange={change("identityType")}
          >
            <option value="AADHAAR">Aadhaar</option>
            <option value="PAN">PAN</option>
          </select>
        </Field>
        <Field label="Aadhaar / PAN number" hint="Required">
          <input
            required
            value={form.identityNumber || ""}
            onChange={change("identityNumber")}
            placeholder={
              form.identityType === "PAN" ? "PAN number" : "Aadhaar number"
            }
          />
        </Field>
        <Field label="Client sites" hint="Separate sites with commas">
          <input
            value={form.siteNames}
            onChange={change("siteNames")}
            placeholder="Tower A, Warehouse B"
          />
        </Field>
        <Field label="Billing address">
          <input
            value={form.billingAddress || ""}
            onChange={change("billingAddress")}
            placeholder="Optional"
          />
        </Field>
        <Field label="GSTIN" hint="Optional for non-GST clients">
          <input
            value={form.gstin || ""}
            onChange={change("gstin")}
            placeholder="e.g. 36AAJCP7575R1ZA"
          />
        </Field>
        <Field label="PAN number">
          <input
            value={form.panNumber || ""}
            onChange={change("panNumber")}
            placeholder="e.g. AAJCP7575R"
          />
        </Field>
        <Field label="Place of supply">
          <input
            value={form.placeOfSupply || ""}
            onChange={change("placeOfSupply")}
            placeholder="e.g. Telangana"
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
            className={`${styles["button-ghost"]}`}
            type="button"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className={`${styles["button-primary"]}`} loading={saving}>
            Save client
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState();
  const [deleting, setDeleting] = useState();
  const [error, setError] = useState("");
  const load = () =>
    request(api.get("/clients", { params: { search } }))
      .then(({ clients: result }) => setClients(result))
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [search]);
  const save = (client) => {
    setAdding(false);
    setEditing(null);
    setClients((current) =>
      current.some((item) => item._id === client._id)
        ? current.map((item) => (item._id === client._id ? client : item))
        : [client, ...current],
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="CLIENT DIRECTORY"
        title="Clients & sites"
        detail="Keep the people and places you supply in one searchable directory."
        action={
          <AddButton
            className={`${styles["button-primary"]}`}
            onClick={() => setAdding(true)}
          >
            Add client
          </AddButton>
        }
      />
      <Panel
        action={
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search client name…"
          />
        }
      >
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Sites</th>
                <th>Billing address</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client._id}>
                  <td>
                    <strong>{client.name}</strong>
                    <small>
                      {client.identityType || "ID"}:{" "}
                      {client.identityNumber || "—"}
                    </small>
                  </td>
                  <td>
                    <strong>{client.contactPerson || "—"}</strong>
                    <small>{client.phone || "No phone"}</small>
                  </td>
                  <td>
                    {client.sites?.length
                      ? client.sites.map((site) => (
                          <span
                            className={`${styles["tag"]}`}
                            key={site._id || site.name}
                          >
                            {site.name}
                          </span>
                        ))
                      : "—"}
                  </td>
                  <td>{client.billingAddress || "—"}</td>
                  <td className={`${styles["actions"]}`}>
                    <button
                      className={`${styles["icon-button"]}`}
                      title="Edit client"
                      onClick={() => setEditing(client)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className={`${styles["icon-button"]} ${styles["delete-button"]}`}
                      title="Delete client"
                      onClick={() => setDeleting(client)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!clients.length && (
                <tr>
                  <td colSpan="5">
                    <Empty
                      title="No clients yet"
                      detail="Add a client before creating a work-supply record."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {adding && <ClientForm onClose={() => setAdding(false)} onSaved={save} />}{" "}
      {editing && (
        <ClientForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={save}
        />
      )}
      {deleting && (
        <DeleteConfirm
          itemLabel={`client ${deleting.name}`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request(api.delete(`/clients/${deleting._id}`));
            setClients((current) =>
              current.filter((item) => item._id !== deleting._id),
            );
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
