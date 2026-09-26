import styles from "../styles/design.module.css";
export const errorMessage = (error) =>
  error?.message || "Unable to save changes.";
export const typeTitle = () => "Labour";
export const typeClass = () => "teal";

export function Metric({
  label,
  value,
  detail,
  tone = "teal",
  icon: Icon,
  className = "",
}) {
  return (
    <article
      className={`${styles["metric"]} ${styles[`metric-${tone}`]} ${className}`}
    >
      <div className={`${styles["metric-top"]}`}>
        <span>{label}</span>
        {Icon && <Icon size={19} />}
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
export function ErrorNote({ error }) {
  return error ? (
    <p className={`${styles["form-error"]} ${styles["panel-error"]}`}>
      {error}
    </p>
  ) : null;
}
export function SectionTabs({ value, onChange, showAttendance = false }) {
  return (
    <div className={`${styles["section-tabs"]}`}>
      <button
        className={value === "LABOUR" ? styles.active : ""}
        onClick={() => onChange("LABOUR")}
      >
        Labour
      </button>
      {showAttendance && (
        <button
          className={value === "ATTENDANCE" ? styles.active : ""}
          onClick={() => onChange("ATTENDANCE")}
        >
          Attendance
        </button>
      )}
    </div>
  );
}
