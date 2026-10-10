import styles from "../styles/design.module.css";
import { useState } from "react";
import api, { request } from "../services/apiClient.js";
import { Button, Field, Modal } from "./ui/index.jsx";
import { ErrorNote, errorMessage } from "../pages/shared.jsx";
import { parseCsv } from "../utils/paymentLedger.js";

const downloadTemplate = () => {
  const template = [
    "name,phone,aadhaarNumber,address,skill,defaultDailyRate,joiningDate,companyName,teamName,workZone,overtimeHourlyRate,active,notes",
    'Ramesh Yadav,9876543210,123456789012,"Village, District",Mason,600,2026-10-09,Example Company,Alpha,Mumbai,60,true,',
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${template}`], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "labour-upload-template.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function BulkWorkerUploadModal({ onClose, onCompleted }) {
  const [records, setRecords] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const parseFile = async (file) => {
    setFileName(file.name);
    setError("");
    setRecords([]);
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Choose a CSV file, or download the template first.");
      }
      const [headers, ...rows] = parseCsv(await file.text());
      const indexes = new Map(
        headers.map((header, index) => [
          header.replace(/[\s_-]/g, "").toLowerCase(),
          index,
        ]),
      );
      const get = (row, key) => row[indexes.get(key.toLowerCase())] || "";
      const parsed = rows.map((row, index) => {
        const worker = {
          type: "LABOUR",
          name: get(row, "name"),
          phone: get(row, "phone"),
          aadhaarNumber: get(row, "aadhaarNumber"),
          address: get(row, "address"),
          skill: get(row, "skill"),
          defaultDailyRate: Number(get(row, "defaultDailyRate")),
          joiningDate: get(row, "joiningDate"),
          companyName: get(row, "companyName"),
          teamName: get(row, "teamName"),
          workZone: get(row, "workZone"),
          overtimeHourlyRate: Number(get(row, "overtimeHourlyRate") || 0),
          active: !["no", "false", "0", "inactive"].includes(
            get(row, "active").toLowerCase(),
          ),
          notes: get(row, "notes"),
        };
        const issues = [];
        if (!worker.name) issues.push("Name required");
        if (!worker.phone) issues.push("Phone required");
        if (!/^\d{12}$/.test(worker.aadhaarNumber)) {
          issues.push("Aadhaar must be 12 digits");
        }
        if (!worker.address) issues.push("Address required");
        if (!worker.skill) issues.push("Skill required");
        if (
          !Number.isFinite(worker.defaultDailyRate) ||
          worker.defaultDailyRate < 0
        ) {
          issues.push("Daily rate invalid");
        }
        if (
          !worker.joiningDate ||
          Number.isNaN(Date.parse(worker.joiningDate))
        ) {
          issues.push("Joining date invalid");
        }
        return { rowNumber: index + 2, worker, issues };
      });
      if (!rows.length) throw new Error("The CSV file has no labour rows.");
      if (parsed.length > 500) {
        throw new Error("Upload is limited to 500 labour rows at a time.");
      }
      setRecords(parsed);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const uploadRecords = async () => {
    const valid = records.filter((record) => !record.issues.length);
    if (!valid.length) {
      setError("There are no valid labour rows to upload.");
      return;
    }
    setUploading(true);
    setError("");
    let succeeded = 0;
    const failed = [];
    const failedRows = new Set();
    for (const [index, record] of valid.entries()) {
      setProgress(`Uploading ${index + 1} of ${valid.length}…`);
      try {
        await request(api.post("/workers", record.worker));
        succeeded += 1;
      } catch (err) {
        failed.push(`Row ${record.rowNumber}: ${errorMessage(err)}`);
        failedRows.add(record.rowNumber);
      }
    }
    setUploading(false);
    setProgress("");
    if (failedRows.size) {
      setRecords((current) =>
        current.filter(
          (record) =>
            record.issues.length || failedRows.has(record.rowNumber),
        ),
      );
    }
    if (succeeded) await onCompleted();
    if (failed.length) {
      setError(
        `${succeeded} uploaded; ${failed.length} failed. ${failed.join("; ")}`,
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      title="Bulk upload labour"
      onClose={uploading ? () => {} : onClose}
      wide
    >
      <div className={styles["bulk-upload-content"]}>
        <p>
          Upload up to 500 labour profiles from CSV. Name, phone, Aadhaar,
          address, skill, daily rate and joining date are required. Photos and
          documents can be added later from each profile.
        </p>
        <Button
          type="button"
          className={styles["button-secondary"]}
          onClick={downloadTemplate}
        >
          Download CSV template
        </Button>
        <Field label="Choose labour CSV">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) parseFile(file);
            }}
          />
        </Field>
        {fileName && <p className={styles["form-hint"]}>File: {fileName}</p>}
        {records.length > 0 && (
          <div className={styles["bulk-upload-preview"]}>
            <strong>{records.length} rows found</strong>
            <span>
              {records.filter((record) => !record.issues.length).length} ready
              to upload
            </span>
            {records
              .filter((record) => record.issues.length)
              .slice(0, 10)
              .map((record) => (
                <small key={record.rowNumber}>
                  Row {record.rowNumber}: {record.issues.join(", ")}
                </small>
              ))}
          </div>
        )}
        <ErrorNote error={error} />
        {progress && <p aria-live="polite">{progress}</p>}
        <div className={styles["modal-actions"]}>
          <Button
            type="button"
            className={styles["button-ghost"]}
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={styles["button-primary"]}
            onClick={uploadRecords}
            loading={uploading}
            disabled={!records.some((record) => !record.issues.length)}
          >
            Upload labour
          </Button>
        </div>
      </div>
    </Modal>
  );
}
