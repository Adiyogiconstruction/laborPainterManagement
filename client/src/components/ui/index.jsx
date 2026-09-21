import styles from "../../styles/design.module.css";
import { AlertTriangle, X, LoaderCircle, Plus, Search } from "lucide-react";
import { useState } from "react";

export function PageHeader({ eyebrow, title, detail, action }) {
  return (
    <div className={`${styles["page-header"]}`}>
      <div>
        <p className={`${styles["eyebrow"]}`}>{eyebrow}</p>
        <h1>{title}</h1>
        {detail && <p className={`${styles["page-detail"]}`}>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, detail, action, children, className = "" }) {
  return (
    <section className={`${styles["panel"]} ${className}`}>
      <div className={`${styles["panel-header"]}`}>
        {title && (
          <div>
            <h2>{title}</h2>
            {detail && <p>{detail}</p>}
          </div>
        )}
        {action}
      </div>
      {children}
    </section>
  );
}

export function Modal({ title, children, onClose, wide = false }) {
  return (
    <div
      className={`${styles["modal-backdrop"]}`}
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className={`${styles["modal"]} ${wide ? styles["modal-wide"] : ""}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={`${styles["modal-head"]}`}>
          <h2>{title}</h2>
          <button
            className={`${styles["icon-button"]}`}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function DeleteConfirm({ itemLabel, onClose, onConfirm }) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const confirm = async (event) => {
    event.preventDefault();
    if (confirmation !== "DELETE") return;
    setDeleting(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message || "Unable to delete this record.");
      setDeleting(false);
    }
  };
  return (
    <Modal
      title="Confirm permanent deletion"
      onClose={deleting ? () => {} : onClose}
    >
      <form className={`${styles["delete-confirm"]}`} onSubmit={confirm}>
        <div className={`${styles["delete-warning"]}`}>
          <AlertTriangle size={20} />
          <p>
            This will permanently delete <strong>{itemLabel}</strong>. This
            action cannot be undone.
          </p>
        </div>
        <Field label="Type DELETE to continue">
          <input
            autoFocus
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </Field>
        {error && <p className={`${styles["form-error"]}`}>{error}</p>}
        <div className={`${styles["modal-actions"]}`}>
          <Button
            type="button"
            className={`${styles["button-ghost"]}`}
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className={`${styles["button-danger"]}`}
            loading={deleting}
            disabled={confirmation !== "DELETE"}
          >
            Delete permanently
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className={`${styles["field"]}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Button({
  children,
  icon: Icon,
  className = "",
  loading,
  ...props
}) {
  return (
    <button
      className={`${styles["button"]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <LoaderCircle className={`${styles["spin"]}`} size={17} />
      ) : (
        Icon && <Icon size={17} />
      )}
      {children}
    </button>
  );
}

export function AddButton({ children = "Add new", ...props }) {
  return (
    <Button icon={Plus} {...props}>
      {children}
    </Button>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Search records…",
}) {
  return (
    <label className={`${styles["search"]}`}>
      <Search size={17} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function Empty({
  title = "Nothing to show yet",
  detail = "Add your first record to start tracking it here.",
}) {
  return (
    <div className={`${styles["empty"]}`}>
      <div className={`${styles["empty-symbol"]}`}>⌁</div>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

export function Status({ children, tone = "neutral" }) {
  return (
    <span
      className={`${styles["status"]} ${styles[String(tone).toLowerCase().replace("_", "-")] || ""}`}
    >
      {children}
    </span>
  );
}

export function LoadingPage() {
  return (
    <main className={`${styles["loading-page"]}`}>
      <LoaderCircle className={`${styles["spin"]}`} size={30} />
      <p>Loading your workspace…</p>
    </main>
  );
}
