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

function ClientForm({ businessType, initial, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name || "",
          businessType: initial.businessType || businessType,
          siteRows: initial.sites?.length
            ? initial.sites.map((site) => ({
                name: site.name || "",
              }))
            : [{ name: "" }],
        }
      : {
          name: "",
          businessType,
          siteRows: [{ name: "" }],
        },
  );
  useEffect(() => {
    setForm((current) => ({
      ...current,
      businessType,
    }));
  }, [businessType]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });
  const changeSite = (index, field) => (event) =>
    setForm({
      ...form,
      siteRows: form.siteRows.map((site, siteIndex) =>
        siteIndex === index ? { ...site, [field]: event.target.value } : site,
      ),
    });
  const addSite = () =>
    setForm({
      ...form,
      siteRows: [...form.siteRows, { name: "" }],
    });
  const removeSite = (index) =>
    setForm({
      ...form,
      siteRows: form.siteRows.filter((_, siteIndex) => siteIndex !== index),
    });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name.trim(),
        businessType: form.businessType,
        sites: form.siteRows
          .map((site) => ({ name: site.name.trim() }))
          .filter((site) => site.name),
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
        <Field label="Management section">
          <input
            value={businessType === "PAINTER" ? "Painter" : "Labour"}
            readOnly
          />
        </Field>
        <div className={`${styles["site-editor"]}`}>
          <div className={`${styles["site-editor-head"]}`}>
            <div>
              <strong>Client sites</strong>
              <small>Track each site separately</small>
            </div>
            <Button
              type="button"
              icon={Plus}
              className={`${styles["button-secondary"]}`}
              onClick={addSite}
            >
              Add site
            </Button>
          </div>
          <div className={`${styles["site-rows"]}`}>
            {form.siteRows.map((site, index) => (
              <div className={`${styles["site-row"]}`} key={index}>
                <input
                  aria-label={`Site ${index + 1} name`}
                  value={site.name}
                  onChange={changeSite(index, "name")}
                  placeholder="Site name"
                />
                <button
                  type="button"
                  className={`${styles["icon-button"]}`}
                  onClick={() => removeSite(index)}
                  aria-label={`Remove site ${index + 1}`}
                  title="Remove site"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
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

export function ClientsPage({ businessType = "LABOUR" }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState();
  const [deleting, setDeleting] = useState();
  const [error, setError] = useState("");
  const load = () =>
    request(api.get("/clients", { params: { search, type: businessType } }))
      .then(({ clients: result }) => setClients(result))
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [search, businessType]);
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
        eyebrow={
          businessType === "PAINTER"
            ? "PAINTER CLIENT DIRECTORY"
            : "LABOUR CLIENT DIRECTORY"
        }
        title={`${businessType === "PAINTER" ? "Painter" : "Labour"} clients & sites`}
        detail={
          businessType === "PAINTER"
            ? "Keep all painter clients, locations and site details in one searchable directory."
            : "Keep all labour clients, locations and site details in one searchable directory."
        }
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
            placeholder={
              businessType === "PAINTER"
                ? "Search painter client name…"
                : "Search labour client name…"
            }
          />
        }
      >
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Sites</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client._id}>
                  <td>
                    <strong>{client.name}</strong>
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
      {adding && (
        <ClientForm
          businessType={businessType}
          onClose={() => setAdding(false)}
          onSaved={save}
        />
      )}
      {editing && (
        <ClientForm
          businessType={businessType}
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
