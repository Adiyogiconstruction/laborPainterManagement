import styles from "../styles/design.module.css";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Download,
  Eye,
  FilePlus2,
  IndianRupee,
  Landmark,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  UserRoundX,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import api, { request } from "../services/apiClient.js";
import { subscribeToPaymentChanges } from "../utils/paymentEvents.js";
import companyLogo from "../assets/image.png";
import { BulkWorkerUploadModal } from "../components/BulkWorkerUploadModal.jsx";
import "@fontsource/noto-sans-devanagari/400.css";
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
  errorMessage,
  typeTitle,
} from "./shared.jsx";

const apiOrigin = (import.meta.env.VITE_API_URL || "/api").replace(
  /\/api\/?$/,
  "",
);

const monthBounds = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(days).padStart(2, "0")}`,
  };
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const statusLabel = (worker) => {
  const status =
    worker.labourStatus || (worker.active ? "ACTIVE" : "INACTIVE");
  return status === "WENT_HOME"
    ? "Went Home"
    : status === "ACTIVE"
      ? "Active"
      : "Inactive";
};

const imageUrl = (worker, urlField, legacyPathField) => {
  const value = worker[urlField] || worker[legacyPathField];
  return value?.startsWith("http") ? value : `${apiOrigin}${value || ""}`;
};

const exportColumns = [
  ["Name", "name"],
  ["Company", "companyName"],
  ["Team", "teamName"],
  ["Phone", "phone"],
  ["Aadhaar number", "aadhaarNumber"],
  ["Address", "address"],
  ["Skill", "skill"],
  ["Work zone", "workZone"],
  ["Joining date", "joiningDate"],
  ["PPE kit given", "ppeKitIssuedOn"],
  ["Default daily rate", "defaultDailyRate"],
  ["OT hourly rate", "overtimeHourlyRate"],
  ["Status", "active"],
  ["Notes", "notes"],
];

const pdfExportColumns = [
  ["Company", "companyName"],
  ["Team", "teamName"],
  ["Photo", "photo"],
  ["Contact Number", "phone"],
  ["Skill", "skill"],
  ["PPE Given", "ppeKitIssuedOn"],
  ["Work Zone", "workZone"],
  ["Default Rate / Day", "defaultDailyRate"],
  ["OT Rate / Hour", "overtimeHourlyRate"],
  ["Status", "active"],
  ["Payable", "totalPayable"],
  ["Joining Date", "joiningDate"],
  ["Net Paid", "netPaid"],
];

const exportValue = (worker, key) => {
  if (key === "active") {
    const status =
      worker.labourStatus || (worker.active ? "ACTIVE" : "INACTIVE");
    return status === "WENT_HOME"
      ? "Went Home"
      : status === "ACTIVE"
        ? "Active"
        : "Inactive";
  }
  if (key === "joiningDate" || key === "ppeKitIssuedOn") {
    return worker[key] ? date(worker[key]) : "";
  }
  if (key === "totalPayable" || key === "netPaid") {
    return worker[key] == null ? "" : money(worker[key]);
  }
  return worker[key] ?? "";
};

const htmlValue = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function printWorkers(
  workers,
  type,
  profile = null,
  selectedColumns = [],
  printWindow,
) {
  if (!printWindow) {
    throw new Error("Allow pop-ups to generate the workforce PDF.");
  }
  const columns = pdfExportColumns.filter(([, key]) =>
    selectedColumns.includes(key),
  );
  const headers = [
    "<th>Sr. No.</th>",
    "<th>Labour Name</th>",
    ...columns.map(([label]) => `<th>${htmlValue(label)}</th>`),
  ].join("");
  const rows = workers
    .map(
      (worker, index) =>
        `<tr><td>${index + 1}</td><td>${htmlValue(worker.name)}</td>${columns
          .map(
            ([, key]) => {
              if (key === "photo") {
                const photo = worker.photoUrl || worker.photoPath;
                return `<td>${photo ? `<img class="worker-photo" src="${htmlValue(imageUrl(worker, "photoUrl", "photoPath"))}" alt="${htmlValue(worker.name)}" onerror="this.style.display='none'"/>` : ""}</td>`;
              }
              return `<td>${htmlValue(exportValue(worker, key))}</td>`;
            },
          )
          .join("")}</tr>`,
    )
    .join("");

  const companyName = profile?.companyName || "Company Name";
  const companyAddress = profile?.address || "Address";
  const companyPhone = profile?.mobile || "";
  const companyEmail = profile?.email || "";
  const companyGstin = profile?.gstin || "";
  const companyPan = profile?.pan || "";
  const companyLogoUrl = profile?.logoUrl || companyLogo;
  const contactLine = [companyPhone, companyEmail].filter(Boolean).join(" | ");
  const idLine = [
    companyGstin ? `GSTIN: ${companyGstin}` : "",
    companyPan ? `PAN: ${companyPan}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  printWindow.document.write(
    `<!doctype html><html><head><title>${typeTitle(type)} workforce</title><style>body{font-family:Arial,sans-serif;color:#192827;margin:0;padding:18px;background:#fff}.company-header{display:flex;align-items:center;gap:18px;border:2px solid #1e514c;padding:14px 16px;margin-bottom:16px;background:#f6fbfa}.company-logo{width:86px;height:86px;object-fit:contain;border:1px solid #d9eae8;padding:6px;background:#fff}.company-meta{flex:1;text-align:center}.company-meta h1{margin:0;font-size:24px;letter-spacing:0.03em;color:#17312f}.company-meta p{margin:5px 0;font-size:11px;color:#5b6b69;line-height:1.4}.company-meta .title{display:block;margin-top:6px;font-size:12px;font-weight:700;letter-spacing:0.08em;color:#17312f}.summary-line{font-size:12px;color:#71817e;margin:0 0 10px}.table-wrap{overflow:hidden;border:1px solid #dce8e5}table{border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:9px;line-height:1.3;font-weight:400}th,td{border:1px solid #dce8e5;padding:5px;text-align:left;vertical-align:top;font-family:Arial,sans-serif;font-size:9px;line-height:1.3;font-weight:400}th{background:#e3f4f0;text-transform:uppercase}.worker-photo{width:42px;height:42px;object-fit:cover;border-radius:50%}</style></head><body><section class="company-header"><img class="company-logo" src="${companyLogoUrl}" onerror="this.style.display='none'"/><div class="company-meta"><h1>${htmlValue(companyName)}</h1><p>${htmlValue(companyAddress)}</p>${contactLine ? `<p>${htmlValue(contactLine)}</p>` : ""}${idLine ? `<p>${htmlValue(idLine)}</p>` : ""}<span class="title">${htmlValue(typeTitle(type).toUpperCase())} WORKFORCE</span></div></section><p class="summary-line">${workers.length} records</p><div class="table-wrap"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div></body></html>`,
  );
  printWindow.onload = async () => {
    await Promise.all(
      [...printWindow.document.images].map((image) =>
        image.decode().catch(() => undefined),
      ),
    );
    printWindow.print();
  };
  printWindow.document.close();
}

function printWorkerProfile(worker, data, period) {
  const printWindow = window.open("", "_blank", "width=1200,height=900");
  if (!printWindow) return;
  const rows = (items, columns) =>
    items
      .map(
        (item) =>
          `<tr>${columns.map((column) => `<td>${htmlValue(column(item))}</td>`).join("")}</tr>`,
      )
      .join("");
  const summary = data.attendanceSummary || {};
  const periodText =
    period.from || period.to
      ? `${period.from || "Beginning"} to ${period.to || "Today"}`
      : "All time";
  printWindow.document.write(
    `<!doctype html><html><head><title>${htmlValue(worker.name)} worker report</title><style>body{font-family:Arial,sans-serif;color:#192827;padding:24px}h1{margin:0 0 4px;font-size:22px}h2{margin:24px 0 8px;font-size:14px;border-bottom:1px solid #dce8e5;padding-bottom:6px}p{color:#71817e;font-size:11px;margin:4px 0}table{border-collapse:collapse;width:100%;font-size:10px;margin-top:8px}th,td{border:1px solid #dce8e5;padding:6px;text-align:left;vertical-align:top}th{background:#e3f4f0;text-transform:uppercase;font-size:9px}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:14px}.metric{border:1px solid #dce8e5;padding:9px}.metric strong{display:block;font-size:15px}.metric span{font-size:9px;color:#71817e}</style></head><body><h1>${htmlValue(worker.name)}</h1><p>${htmlValue(typeTitle(worker.type))} · ${htmlValue(worker.skill || "Worker")} · Report period: ${htmlValue(periodText)}</p><p>Phone: ${htmlValue(worker.phone)} · Team: ${htmlValue(worker.teamName || "—")} · Work zone: ${htmlValue(worker.workZone || "—")}</p><div class="summary"><div class="metric"><strong>${summary.days || 0}</strong><span>Attendance days</span></div><div class="metric"><strong>${summary.presentDays || 0}</strong><span>Present days</span></div><div class="metric"><strong>${summary.doubleDays || 0}</strong><span>Double-work days</span></div><div class="metric"><strong>${htmlValue(money(summary.totalPayable || 0))}</strong><span>Total payable</span></div><div class="metric"><strong>${htmlValue(money(summary.netPaid ?? summary.totalPaid ?? 0))}</strong><span>Net paid</span></div><div class="metric"><strong>${htmlValue(money(summary.totalReturned || 0))}</strong><span>Received back</span></div><div class="metric"><strong>${htmlValue(money(summary.totalDue || 0))}</strong><span>Due</span></div><div class="metric"><strong>${htmlValue(money(summary.overpaid || 0))}</strong><span>Extra paid</span></div></div><h2>Attendance</h2><table><thead><tr><th>Date</th><th>Site / work</th><th>Status</th><th>Units</th><th>Payable</th></tr></thead><tbody>${rows(data.attendance || [], [(item) => date(item.date), (item) => item.assignment?.siteName || "—", (item) => item.status, (item) => item.workUnits || 0, (item) => money(item.payableAmount || 0)])}</tbody></table><h2>Work assignments</h2><table><thead><tr><th>Site / client</th><th>Work</th><th>Start</th><th>Days</th><th>Status</th></tr></thead><tbody>${rows(data.assignments || [], [(item) => item.siteName, (item) => item.workDescription, (item) => date(item.startDate), (item) => item.workDays || 0, (item) => item.status])}</tbody></table><h2>Payment history</h2><table><thead><tr><th>Date</th><th>Entry</th><th>Work record</th><th>Diya</th><th>Liya</th></tr></thead><tbody>${rows(data.payments || [], [(item) => date(item.paidOn), (item) => item.flow === "INFLOW" ? `Liya · ${item.kind}` : item.kind, (item) => item.assignment?.siteName || "—", (item) => item.flow === "INFLOW" ? "—" : money(item.amount), (item) => item.flow === "INFLOW" ? money(item.amount) : "—"])}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`,
  );
  printWindow.document.close();
  printWindow.onload = () => {
    const tables = printWindow.document.querySelectorAll("table");
    tables[0]
      ?.querySelectorAll("th:nth-child(2), td:nth-child(2)")
      .forEach((cell) => cell.remove());
    tables[2]
      ?.querySelectorAll("th:nth-child(3), td:nth-child(3)")
      .forEach((cell) => cell.remove());
    printWindow.print();
  };
}

function printWorkerOnboarding(worker, profile) {
  const printWindow = window.open("", "_blank", "width=1000,height=1200");
  if (!printWindow) return;
  const value = (item) => htmlValue(item || "-");
  const photo = imageUrl(worker, "photoUrl", "photoPath");
  const front = imageUrl(worker, "aadhaarFrontPath", "aadhaarFrontUrl");
  const back = imageUrl(worker, "aadhaarBackPath", "aadhaarBackUrl");
  const rules = (profile?.rules || [])
    .map((rule, index) => `<li>${index + 1}. ${value(rule)}</li>`)
    .join("");
  printWindow.document
    .write(`<!doctype html><html><head><title>${value(worker.name)} - Worker profile</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#182827;margin:0;padding:24px;background:#fff}h1,h2,p{margin:0}h1{font-size:24px;text-transform:uppercase}h2{font-size:15px;background:#e5f3f0;border:1px solid #1e514c;padding:8px;text-align:center;margin-top:18px}.header{display:flex;gap:18px;align-items:center;border:2px solid #1e514c;padding:16px}.brand{flex:1;text-align:center}.brand p{font-size:11px;margin-top:5px}.logo{width:92px;height:92px;object-fit:contain}.grid{display:grid;grid-template-columns:repeat(2,1fr);border:1px solid #879693}.field{display:grid;grid-template-columns:145px 1fr;border-bottom:1px solid #c5cfcd;border-right:1px solid #c5cfcd;min-height:34px}.field:nth-child(2n){border-right:0}.label{font-weight:700;background:#f2f7f6;padding:8px;font-size:11px}.value{padding:8px;font-size:12px}.photo{width:150px;height:150px;object-fit:cover;border:1px solid #879693}.photo-cell{text-align:center;padding:10px;border:1px solid #879693}.docs{display:grid;grid-template-columns:1fr 1fr;gap:12px}.doc{border:1px solid #879693;text-align:center}.doc img{width:100%;height:220px;object-fit:contain}.doc p{background:#f2f7f6;padding:7px;font-weight:700;font-size:11px}.rules{border:1px solid #879693;padding:10px}.rules li{font-size:11px;margin:7px 0}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:48px}.signatures div{border-top:1px solid #182827;text-align:center;padding-top:6px;font-size:11px}@media print{body{padding:10px}.page-break{break-before:page}}
  </style></head><body><section class="header"><img class="logo" src="${value(profile?.logoUrl)}" onerror="this.style.display='none'"/><div class="brand"><h1>${value(profile?.companyName)}</h1><p>${value(profile?.address)}</p><p>Mobile: ${value(profile?.mobile)} | Email: ${value(profile?.email)}</p><p>GSTIN: ${value(profile?.gstin)} | PAN: ${value(profile?.pan)}</p><strong>LABOUR ONBOARDING & PPE DECLARATION</strong></div></section>
  <h2>Personal Details</h2><div class="grid"><div class="field"><span class="label">Full name</span><span class="value">${value(worker.name)}</span></div><div class="field"><span class="label">Company</span><span class="value">${value(worker.companyName || profile?.companyName)}</span></div><div class="field"><span class="label">Aadhaar / ID</span><span class="value">${value(worker.aadhaarNumber)}</span></div><div class="field"><span class="label">Mobile number</span><span class="value">${value(worker.phone)}</span></div><div class="field"><span class="label">Address</span><span class="value">${value(worker.address)}</span></div><div class="photo-cell"><img class="photo" src="${value(photo)}" onerror="this.style.display='none'"/></div></div>
  <h2>Work Details</h2><div class="grid"><div class="field"><span class="label">Company</span><span class="value">${value(worker.companyName)}</span></div><div class="field"><span class="label">Work category</span><span class="value">${value(worker.skill)}</span></div><div class="field"><span class="label">Team</span><span class="value">${value(worker.teamName)}</span></div><div class="field"><span class="label">Work zone</span><span class="value">${value(worker.workZone)}</span></div><div class="field"><span class="label">Joining date</span><span class="value">${value(date(worker.joiningDate))}</span></div><div class="field"><span class="label">Daily rate</span><span class="value">${value(money(worker.defaultDailyRate))}</span></div></div>
  <h2>Safety & PPE Details</h2><div class="grid"><div class="field"><span class="label">PPE kit issued</span><span class="value">${value(worker.ppeKitIssuedOn ? date(worker.ppeKitIssuedOn) : "Not issued")}</span></div><div class="field"><span class="label">OT rate / hour</span><span class="value">${value(money(worker.overtimeHourlyRate || 0))}</span></div></div>
  <div class="signatures"><div>Labour signature / thumb</div><div>Contractor signature</div><div>Supervisor signature & company stamp</div></div>
  <section class="page-break"><h2>Appendix - Documents & Terms</h2><div class="docs"><div class="doc"><img src="${value(front)}" onerror="this.style.display='none'"/><p>Aadhaar Card (Front)</p></div><div class="doc"><img src="${value(back)}" onerror="this.style.display='none'"/><p>Aadhaar Card (Back)</p></div></div><h2>Terms & Conditions</h2><ol class="rules">${rules || "<li>No rules configured.</li>"}</ol></section><script>window.onload=()=>window.print();</script></body></html>`);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.document
      .querySelector(".page-break")
      ?.classList.remove("page-break");
    printWindow.document.body.style.zoom = "0.72";
    printWindow.print();
  };
}

function printWorkerOnboardingCompact(worker, profile) {
  const printWindow = window.open("", "_blank", "width=1000,height=1200");
  if (!printWindow) return;
  const value = (item) => htmlValue(item || "-");
  const placeholder =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23eef4f2'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle' fill='%2371817e' font-family='Arial' font-size='16'%3ENot available%3C/text%3E%3C/svg%3E";
  const image = (url) => (url && url !== apiOrigin ? url : placeholder);
  const photo = imageUrl(worker, "photoUrl", "photoPath");
  const front = imageUrl(worker, "aadhaarFrontPath", "aadhaarFrontUrl");
  const back = imageUrl(worker, "aadhaarBackPath", "aadhaarBackUrl");
  const rules = (profile?.rules || [])
    .map((rule) => `<div class="rule">${value(rule)}</div>`)
    .join("");
  const ppe = worker.ppeKitIssuedOn
    ? `<div class="row"><b>PPE kit issued</b><span>${value(date(worker.ppeKitIssuedOn))}</span></div>`
    : "";
  printWindow.document
    .write(`<!doctype html><html><head><title>${value(worker.name)} - Worker profile</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172625;margin:0;padding:12px;background:#fff;font-size:9px}h1,h2,p{margin:0}h1{font-size:18px;text-transform:uppercase}h2{font-size:10px;text-align:center;background:#e5f3f0;border:1px solid #345d58;padding:3px;margin-top:6px}.header{display:grid;grid-template-columns:100px 1fr;gap:12px;align-items:center;border:1.5px solid #172625;padding:6px}.logo{width:88px;height:58px;object-fit:contain}.company{text-align:center}.company p{font-size:8px;margin-top:2px}.company strong{display:block;font-size:10px;margin-top:3px}.personal{display:grid;grid-template-columns:1fr 100px;border:1px solid #687976}.details{display:grid;grid-template-columns:1fr 1fr}.row{display:grid;grid-template-columns:96px 1fr;min-height:21px;border-bottom:1px solid #b7c2c0;border-right:1px solid #b7c2c0}.row b{background:#f1f6f5;padding:4px;font-size:8px}.row span{padding:4px;font-size:9px}.worker-photo{width:94px;height:94px;object-fit:cover;border-left:1px solid #687976}.work-grid{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #687976}.work-grid .row{border-bottom:1px solid #b7c2c0}.ppe{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #687976}.ppe .row{border-bottom:0}.declaration{font-size:8px;font-style:italic;line-height:1.2;padding:5px 3px;border:1px solid #687976;margin-top:5px}.signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;align-items:flex-end;margin-top:8px;padding-top:0;border-top:0}.signature{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center;padding-top:0;font-size:7.5px;line-height:1.3;min-height:42px;position:relative}.signature::before{content:"";display:block;width:100%;height:1px;background:#172625;margin-bottom:6px}.signature:nth-child(3)::before{margin-bottom:4px}.stamp{width:34px;height:34px;border:1px solid #172625;border-radius:50%;display:block;margin:-8px auto 2px;background:#fff;padding:3px;object-fit:contain}.docs{display:grid;grid-template-columns:1fr 1fr;gap:5px}.doc{border:1px solid #687976;text-align:center}.doc img{width:100%;height:216px;object-fit:contain}.doc b{display:block;background:#f1f6f5;padding:3px;font-size:8px}.rules{border:1px solid #687976;padding:4px}.rule{font-size:8px;padding:2px 0;border-bottom:1px solid #d5dddb}.rule:last-child{border-bottom:0}@page{size:A4 portrait;margin:5mm}@media print{body{padding:0}}
  </style></head><body><section class="header"><img class="logo" src="${value(companyLogo)}"/><div class="company"><h1>${value(profile?.companyName)}</h1><p>${value(profile?.address)}</p><p>Mobile: ${value(profile?.mobile)} | Email: ${value(profile?.email)}</p><p>GSTIN: ${value(profile?.gstin)} | PAN: ${value(profile?.pan)}</p><strong>LABOUR ONBOARDING & PPE DECLARATION</strong></div></section>
  <h2>Personal Details</h2><section class="personal"><div class="details"><div class="row"><b>Full name</b><span>${value(worker.name)}</span></div><div class="row"><b>Mobile number</b><span>${value(worker.phone)}</span></div><div class="row"><b>Aadhaar / ID</b><span>${value(worker.aadhaarNumber)}</span></div><div class="row"><b>Company</b><span>${value(worker.companyName || profile?.companyName)}</span></div><div class="row"><b>Address</b><span>${value(worker.address)}</span></div></div><img class="worker-photo" src="${value(image(photo))}"/></section>
  <h2>Work Details</h2><section class="work-grid"><div class="row"><b>Work category</b><span>${value(worker.skill)}</span></div><div class="row"><b>Location</b><span>${value(worker.workZone)}</span></div><div class="row"><b>Joining date</b><span>${value(date(worker.joiningDate))}</span></div><div class="row"><b>Daily rate</b><span>${value(money(worker.defaultDailyRate))}</span></div><div class="row"><b>OT rate</b><span>${value(money(worker.overtimeHourlyRate || 0))}</span></div></section>
  ${ppe ? `<h2>Safety & PPE Details</h2><section class="ppe">${ppe}</section>` : ""}
  <h2>Appendix - Documents & Terms</h2><section class="docs"><div class="doc"><img src="${value(image(front))}"/><b>Aadhaar Card (Front)</b></div><div class="doc"><img src="${value(image(back))}"/><b>Aadhaar Card (Back)</b></div></section><h2>Terms & Conditions</h2><section class="rules">${rules || "<div class='rule'>No rules configured.</div>"}</section><p class="declaration">I hereby declare that the details provided above are true. I confirm receipt of the mentioned safety equipment (PPE) and agree to use them at the workplace.</p><section class="signatures"><div class="signature">Labour Signature / Thumb</div><div class="signature">Contractor Signature</div><div class="signature"><img class="stamp" src="${value(companyLogo)}"/>Supervisor Signature & Company Stamp</div></section><script>window.onload=()=>window.print();</script></body></html>`);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.document.body.style.fontSize = "10px";
    const logo = printWindow.document.querySelector(".logo");
    if (logo) {
      logo.style.width = "154px";
      logo.style.height = "104px";
    }
    const header = printWindow.document.querySelector(".header");
    if (header) {
      header.style.gridTemplateColumns = "160px 1fr";
      header.style.marginBottom = "6px";
      header.style.padding = "10px 12px";
    }
    const workerPhoto = printWindow.document.querySelector(".worker-photo");
    if (workerPhoto) {
      workerPhoto.style.width = "150px";
      workerPhoto.style.height = "150px";
    }
    const personal = printWindow.document.querySelector(".personal");
    if (personal) {
      personal.style.gridTemplateColumns = "1fr 150px";
      personal.style.width = "100%";
    }
    const companyTitle = printWindow.document.querySelector(".company h1");
    if (companyTitle) companyTitle.style.fontSize = "22px";
    printWindow.document.querySelectorAll(".company p").forEach((text) => {
      text.style.fontSize = "9px";
    });
    const companyHeading =
      printWindow.document.querySelector(".company strong");
    if (companyHeading) companyHeading.style.fontSize = "12px";
    printWindow.document
      .querySelectorAll("h1, h2, p, strong, b, span, .signature, .rule")
      .forEach((text) => {
        const currentSize = Number.parseFloat(
          printWindow.getComputedStyle(text).fontSize,
        );
        if (currentSize) text.style.fontSize = `${currentSize * 1.5}px`;
      });
    printWindow.document
      .querySelectorAll("b, strong, .value, .rule")
      .forEach((text) => {
        text.style.fontWeight = "400";
      });
    printWindow.document.querySelectorAll(".work-grid .row").forEach((row) => {
      if (/Daily rate|OT rate/i.test(row.textContent || "")) row.remove();
      row.style.minHeight = "30px";
    });
    printWindow.document.querySelectorAll(".doc img").forEach((image) => {
      image.style.height = "340px";
      image.style.width = "auto";
      image.style.maxWidth = "100%";
      image.style.objectFit = "contain";
    });
    const appendixHeading = Array.from(
      printWindow.document.querySelectorAll("h2"),
    ).find((heading) =>
      /Appendix - Documents & Terms/i.test(heading.textContent),
    );
    if (appendixHeading) {
      appendixHeading.style.marginTop = "24px";
    }
    printWindow.document.querySelectorAll(".rule").forEach((rule) => {
      rule.style.fontSize = "16px";
      rule.style.lineHeight = "1.4";
    });
    printWindow.document.querySelectorAll(".stamp").forEach((stamp) => {
      stamp.style.visibility = "hidden";
      stamp.style.width = "75px";
      stamp.style.height = "75px";
      stamp.style.margin = "0 auto 2px";
    });
    const signatures = printWindow.document.querySelector(".signatures");
    if (signatures) signatures.style.marginTop = "12px";
    printWindow.document.querySelectorAll(".signature").forEach((signature) => {
      signature.style.minHeight = "46px";
    });
    printWindow.document.querySelectorAll(".row").forEach((row) => {
      row.style.minHeight = "28px";
    });
    printWindow.document
      .querySelectorAll(".rules, .docs, .declaration")
      .forEach((block) => {
        block.style.marginTop = "8px";
      });
    printWindow.document.body.style.zoom = "0.86";
    printWindow.print();
  };
}

function WorkerForm({ initial, onClose, onSaved }) {
  const [companies, setCompanies] = useState([]);
  const [companyLoadError, setCompanyLoadError] = useState("");
  const [form, setForm] = useState(() => ({
    ...(initial || {
      type: "LABOUR",
      name: "",
      companyName: "",
      teamName: "",
      phone: "",
      aadhaarNumber: "",
      skill: "",
      workZone: "",
      photoPath: "",
      ppeKitIssuedOn: "",
      defaultDailyRate: "",
      overtimeHourlyRate: "",
      joiningDate: inputDate(),
      labourStatus: "ACTIVE",
      address: "",
      notes: "",
    }),
    rateApplicableFrom: inputDate(),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState(null);
  useEffect(() => {
    request(api.get("/companies"))
      .then((result) => setCompanies(result.companies))
      .catch((err) => setCompanyLoadError(errorMessage(err)));
  }, []);
  const selectedCompany = companies.find(
    (company) => company.name === form.companyName,
  );
  const companyZones = selectedCompany?.zones || [];
  const update = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!String(form.name || "").trim() || !String(form.workZone || "").trim()) {
        throw new Error("Name and work zone are required.");
      }
      const { photoPath, photoUrl, ...workerFields } = form;
      const body = {
        ...workerFields,
        defaultDailyRate: Number(form.defaultDailyRate || 0),
        overtimeHourlyRate: Number(form.overtimeHourlyRate || 0),
        rateApplicableFrom: form.rateApplicableFrom,
      };
      const data = initial
        ? await request(api.patch(`/workers/${initial._id}`, body))
        : await request(api.post("/workers", body));
      let worker = data.worker;
      if (photoFile) {
        const uploadData = new FormData();
        uploadData.append("photo", photoFile);
        const uploaded = await request(
          api.post(`/workers/${worker._id}/photo`, uploadData, {
            headers: { "Content-Type": "multipart/form-data" },
          }),
        );
        worker = uploaded.worker;
      }
      if (aadhaarFrontFile || aadhaarBackFile) {
        if (!aadhaarFrontFile || !aadhaarBackFile) {
          throw new Error("Please select both Aadhaar front and back images.");
        }
        const aadhaarData = new FormData();
        aadhaarData.append("aadhaarFront", aadhaarFrontFile);
        aadhaarData.append("aadhaarBack", aadhaarBackFile);
        const uploaded = await request(
          api.post(`/workers/${worker._id}/aadhaar`, aadhaarData, {
            headers: { "Content-Type": "multipart/form-data" },
          }),
        );
        worker = uploaded.worker;
      }
      onSaved(worker);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={`${initial ? "Edit" : "Add"} ${typeTitle()}`}
      onClose={onClose}
      wide
    >
      <form
        className={`${styles["form-grid"]} ${styles["three-col"]}`}
        onSubmit={save}
      >
        <Field label="Full name" hint="Required">
          <input
            required
            autoFocus
            value={form.name}
            onChange={update("name")}
            placeholder="Worker name"
          />
        </Field>
        <Field label="Company / client" hint="Optional">
          <select
            value={form.companyName || ""}
            onChange={(event) => {
              const companyName = event.target.value;
              const nextCompany = companies.find(
                (company) => company.name === companyName,
              );
              setForm((current) => ({
                ...current,
                companyName,
                workZone:
                  nextCompany?.zones?.includes(current.workZone)
                    ? current.workZone
                    : "",
              }));
            }}
          >
            <option value="">No company selected</option>
            {form.companyName &&
              !companies.some((company) => company.name === form.companyName) && (
                <option value={form.companyName}>
                  {form.companyName} (existing)
                </option>
              )}
            {companies.map((company) => (
              <option key={company._id} value={company.name}>
                {company.name}
              </option>
            ))}
          </select>
          {companyLoadError ? (
            <small className={styles["form-error"]}>{companyLoadError}</small>
          ) : (
            !companies.length && (
              <small>Add a company/client from the Companies page first.</small>
            )
          )}
        </Field>
        <Field label="Labour team" hint="Optional">
          <input
            value={form.teamName || ""}
            onChange={update("teamName")}
            placeholder="e.g. Team A or Ramesh crew"
          />
        </Field>
        <Field label="Mobile number">
          <input
            value={form.phone || ""}
            onChange={update("phone")}
            placeholder="Mobile number"
          />
        </Field>
        <Field label="Aadhaar number">
          <input
            inputMode="numeric"
            pattern="[0-9]{12}"
            maxLength="12"
            value={form.aadhaarNumber || ""}
            onChange={update("aadhaarNumber")}
            placeholder="12-digit Aadhaar number"
          />
        </Field>
        <Field label="Skill / role">
          <input
            value={form.skill || ""}
            onChange={update("skill")}
            placeholder="e.g. Mason helper"
          />
        </Field>
        <Field
          label={form.companyName ? "Company work zone" : "Current work zone"}
          hint={
            form.companyName && companyZones.length
              ? "Choose from this company’s configured zones."
              : "Required"
          }
        >
          {companyZones.length ? (
            <select
              required
              value={form.workZone || ""}
              onChange={update("workZone")}
            >
              <option value="">Select company zone</option>
              {form.workZone && !companyZones.includes(form.workZone) && (
                <option value={form.workZone}>
                  {form.workZone} (existing)
                </option>
              )}
              {companyZones.map((zone) => (
                <option value={zone} key={zone}>
                  {zone}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                required
                list="worker-zones"
                value={form.workZone || ""}
                onChange={update("workZone")}
                placeholder="Select a company to choose its zone"
              />
              <datalist id="worker-zones">
                <option value="Mumbai Zone" />
                <option value="Chennai Zone" />
                <option value="Other" />
              </datalist>
            </>
          )}
        </Field>
        <Field label="Worker photo">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
          />
          {form.photoPath && (
            <small>Existing photo will remain unless replaced.</small>
          )}
        </Field>
        <Field label="Aadhaar card - front">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) =>
              setAadhaarFrontFile(event.target.files?.[0] || null)
            }
          />
          {form.aadhaarFrontPath && (
            <small>Existing front image will remain unless replaced.</small>
          )}
        </Field>
        <Field label="Aadhaar card - back">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) =>
              setAadhaarBackFile(event.target.files?.[0] || null)
            }
          />
          {form.aadhaarBackPath && (
            <small>Existing back image will remain unless replaced.</small>
          )}
        </Field>
        <Field label="PPE kit given on">
          <input
            type="date"
            value={form.ppeKitIssuedOn ? inputDate(form.ppeKitIssuedOn) : ""}
            onChange={update("ppeKitIssuedOn")}
          />
        </Field>
        <Field label="Default daily rate">
          <input
            min="0"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.defaultDailyRate || ""}
            onChange={update("defaultDailyRate")}
            placeholder="₹ per day"
          />
        </Field>
        <Field
          label="OT rate per hour"
          hint="Used as the default overtime rate in attendance"
        >
          <input
            min="0"
            step="0.01"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={form.overtimeHourlyRate || ""}
            onChange={update("overtimeHourlyRate")}
            placeholder="₹ per OT hour"
          />
        </Field>
        <Field
          label="Rate applicable from"
          hint="This rate applies to attendance on this date and afterward."
        >
          <input
            required
            type="date"
            value={form.rateApplicableFrom || inputDate()}
            onChange={update("rateApplicableFrom")}
          />
        </Field>
        <Field label="Joining date">
          <input
            type="date"
            value={inputDate(form.joiningDate || new Date())}
            onChange={update("joiningDate")}
          />
        </Field>
        <Field label="Status">
          <select
            value={
              form.labourStatus || (form.active === false ? "INACTIVE" : "ACTIVE")
            }
            onChange={(event) =>
              setForm({
                ...form,
                labourStatus: event.target.value,
                active: event.target.value === "ACTIVE",
              })
            }
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="WENT_HOME">Went Home</option>
          </select>
        </Field>
        <Field label="Address">
          <input
            value={form.address || ""}
            onChange={update("address")}
            placeholder="Full address"
          />
        </Field>
        <Field label="Notes">
          <input
            value={form.notes || ""}
            onChange={update("notes")}
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
          <Button
            type="submit"
            className={`${styles["button-primary"]}`}
            loading={saving}
          >
            Save {typeTitle()}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function WorkerHistory({ worker, onClose }) {
  const [data, setData] = useState();
  const [companyProfile, setCompanyProfile] = useState();
  const [companyProfileLoaded, setCompanyProfileLoaded] = useState(false);
  const [companyProfileError, setCompanyProfileError] = useState("");
  const [error, setError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [registrationGenerating, setRegistrationGenerating] = useState(false);
  const [month, setMonth] = useState(() =>
    currentMonth(),
  );
  const [period, setPeriod] = useState(() =>
    monthBounds(currentMonth()),
  );
  const [allTime, setAllTime] = useState(false);
  const [attendancePage, setAttendancePage] = useState(1);
  const attendanceLimit = 10;
  const statusPeriods = Array.isArray(worker.statusHistory)
    ? worker.statusHistory
        .map((period, index, periods) => ({
          ...period,
          endAt: periods[index + 1]?.changedAt || null,
        }))
        .filter((period) => period.changedAt || period.endAt)
    : [];
  useEffect(() => {
    let active = true;
    let requestSequence = 0;
    const loadHistory = () => {
      const sequence = ++requestSequence;
      setHistoryLoading(true);
      setError("");
      request(
        api.get(`/workers/${worker._id}/history`, {
          params: {
            ...(allTime ? {} : period),
            attendancePage,
            attendanceLimit,
          },
        }),
      )
        .then((historyData) => {
          if (active && sequence === requestSequence) setData(historyData);
        })
        .catch((err) => {
          if (active && sequence === requestSequence) {
            setError(errorMessage(err));
          }
        })
        .finally(() => {
          if (active && sequence === requestSequence) setHistoryLoading(false);
        });
    };
    loadHistory();
    const unsubscribeFromPaymentChanges = subscribeToPaymentChanges(loadHistory);
    return () => {
      active = false;
      unsubscribeFromPaymentChanges();
    };
  }, [worker._id, period, allTime, attendancePage]);
  useEffect(() => {
    let active = true;
    request(api.get("/company-profile"))
      .then(({ profile }) => {
        if (active) {
          setCompanyProfile(profile);
          setCompanyProfileError("");
        }
      })
      .catch((err) => {
        if (active) {
          setCompanyProfile(null);
          setCompanyProfileError(errorMessage(err));
        }
      })
      .finally(() => {
        if (active) setCompanyProfileLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const changeMonth = (event) => {
    const nextMonth = event.target.value;
    setMonth(nextMonth);
    setPeriod(monthBounds(nextMonth));
    setAllTime(false);
    setAttendancePage(1);
  };
  const toggleAllTime = () => {
    setAllTime((current) => !current);
    setAttendancePage(1);
  };
  const generateRegistrationPdf = async () => {
    setRegistrationGenerating(true);
    setError("");
    try {
      const { worker: registrationWorker } = await request(
        api.get(`/workers/${worker._id}/registration`),
      );
      const { downloadRegistrationPdf } = await import(
        "../utils/registrationPdf.js"
      );
      await downloadRegistrationPdf({
        worker: registrationWorker,
        profile: companyProfile,
        logoUrl: companyLogo,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRegistrationGenerating(false);
    }
  };
  return (
    <Modal
      title={`${worker.name} · History`}
      onClose={onClose}
      wide
      action={
        <Button
          icon={Download}
          className={`${styles["button-secondary"]}`}
          loading={registrationGenerating}
          disabled={!worker || !companyProfileLoaded}
          onClick={generateRegistrationPdf}
        >
          Generate Registration PDF
        </Button>
      }
    >
      <ErrorNote error={error || companyProfileError} />
      <div className={`${styles["toolbar"]} ${styles["filter-bar"]}`}>
        <Field label="History month">
          <input type="month" value={month} onChange={changeMonth} />
        </Field>
        <Button
          type="button"
          className={`${allTime ? styles["button-primary"] : styles["button-secondary"]}`}
          onClick={toggleAllTime}
        >
          {allTime ? "View this month" : "View all time"}
        </Button>
        <span className={`${styles["form-hint"]}`}>
          {allTime
            ? "Showing all attendance and payment history."
            : "Showing attendance and payments for this month."}
        </span>
        <span
          className={`${styles["form-hint"]}`}
          style={{ visibility: historyLoading ? "visible" : "hidden" }}
          aria-live="polite"
        >
          Updating…
        </span>
      </div>
      {!data ? (
        <Empty title="Loading history…" />
      ) : (
        <>
          <div className={`${styles["history-profile"]}`}>
            {worker.photoPath ? (
              <img
                src={imageUrl(worker, "photoUrl", "photoPath")}
                alt={`${worker.name} profile`}
                className={`${styles["history-profile-photo"]}`}
              />
            ) : (
              <div className={`${styles["history-profile-placeholder"]}`}>
                {worker.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <h3>{worker.name}</h3>
              <p>
                {worker.companyName ? `${worker.companyName} · ` : ""}
                {typeTitle(worker.type)} · {worker.skill || "Worker"}
              </p>
            </div>
          </div>
          <Panel
            title="Identity documents"
            detail={`Aadhaar number: ${worker.aadhaarNumber || "Not provided"}`}
          >
            <div className={`${styles["aadhaar-documents"]}`}>
              {[
                ["Front", worker.aadhaarFrontPath],
                ["Back", worker.aadhaarBackPath],
              ].map(([label, path]) => (
                <figure className={`${styles["aadhaar-document"]}`} key={label}>
                  {path ? (
                    <img
                      src={
                        path.startsWith("http") ? path : `${apiOrigin}${path}`
                      }
                      alt={`${worker.name} Aadhaar card ${label.toLowerCase()}`}
                      className={`${styles["aadhaar-document-image"]}`}
                    />
                  ) : (
                    <div className={`${styles["aadhaar-document-missing"]}`}>
                      Not uploaded
                    </div>
                  )}
                  <figcaption>Aadhaar {label}</figcaption>
                </figure>
              ))}
            </div>
          </Panel>
          <Panel
            title="Employment status periods"
            detail="Recorded employment status periods for this labour."
          >
            <div className={`${styles["status-periods"]}`}>
              <div className={`${styles["status-period-current"]}`}>
                Current status:
                <Status
                  tone={
                    (worker.labourStatus || (worker.active ? "ACTIVE" : "INACTIVE")) ===
                    "ACTIVE"
                      ? "teal"
                      : worker.labourStatus === "WENT_HOME"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {statusLabel(worker)}
                </Status>
              </div>
              {statusPeriods.length ? (
                <ol className={`${styles["status-period-list"]}`}>
                  {statusPeriods.map((period, index) => (
                    <li key={`${period.changedAt || "unknown"}-${index}`}>
                      <Status
                        tone={
                          (period.labourStatus ||
                            (period.active ? "ACTIVE" : "INACTIVE")) === "ACTIVE"
                            ? "teal"
                            : period.labourStatus === "WENT_HOME"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {statusLabel(period)}
                      </Status>
                      <span>
                        {period.changedAt ? date(period.changedAt) : "Start date not recorded"}
                        {" — "}
                        {period.endAt ? date(period.endAt) : "Present"}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={`${styles["form-hint"]}`}>
                  No status period dates are recorded yet. Status changes made
                  from now on will appear here; earlier changes cannot be
                  recovered.
                </p>
              )}
              {statusPeriods.some((period) => !period.changedAt) && (
                <p className={`${styles["form-hint"]}`}>
                  This labour’s earlier status start date was not recorded.
                  Dates are tracked from the first status change made here.
                </p>
              )}
            </div>
          </Panel>
          <div className={`${styles["history-grid"]}`}>
            <Panel title="Attendance & payable">
              <div
                className={`${styles["metric-grid"]} ${styles["compact-metrics"]}`}
              >
                <Metric
                  label="Attendance days"
                  value={data.attendanceSummary?.days || 0}
                  tone="teal"
                />
                <Metric
                  label="Present days"
                  value={data.attendanceSummary?.presentDays || 0}
                  tone="teal"
                />
                <Metric
                  label="Double-work days"
                  value={data.attendanceSummary?.doubleDays || 0}
                  tone="purple"
                />
                <Metric
                  label="Triple-work days"
                  value={data.attendanceSummary?.tripleDays || 0}
                  tone="purple"
                />
                <Metric
                  label="Total payable"
                  value={money(data.attendanceSummary?.totalPayable || 0)}
                  tone="amber"
                />
                <Metric
                  label="Given"
                  value={money(data.attendanceSummary?.totalPaid || 0)}
                  tone="blue"
                />
                <Metric
                  label="Received back"
                  value={money(data.attendanceSummary?.totalReturned || 0)}
                  tone="teal"
                />
                <Metric
                  label="Net paid"
                  value={money(data.attendanceSummary?.netPaid || 0)}
                  tone="purple"
                />
                <Metric
                  label="Due"
                  value={money(data.attendanceSummary?.totalDue || 0)}
                  tone="coral"
                />
                <Metric
                  label="Extra paid"
                  value={`+${money(data.attendanceSummary?.overpaid || 0)}`}
                  tone="teal"
                  className={`${styles["payment-extra-metric"]}`}
                />
              </div>
            </Panel>
            <Panel
              title="Daily work and attendance"
              detail="Every marked day, 2P day and overtime amount."
            >
              <div className={`${styles["table-wrap"]}`}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Units</th>
                      <th>OT</th>
                      <th>Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance?.map((item) => (
                      <tr key={item._id}>
                        <td>{date(item.date)}</td>
                        <td>
                          <Status
                            tone={
                              item.status === "DOUBLE_PRESENT"
                                ? "purple"
                                : item.status === "PRESENT"
                                  ? "teal"
                                  : "neutral"
                            }
                          >
                            {item.status.replace("_", " ")}
                          </Status>
                        </td>
                        <td>{item.workUnits || 0}</td>
                        <td>
                          {item.overtimeHours || 0}h ×{" "}
                          {money(item.overtimeRate || 0)}
                        </td>
                        <td className={`${styles["amount"]}`}>
                          {money(item.payableAmount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.attendance?.length && (
                  <Empty title="No attendance records" />
                )}
              </div>
              {data.attendancePagination?.pages > 1 && (
                <div className={`${styles["actions-inline"]}`}>
                  <Button
                    type="button"
                    className={`${styles["button-ghost"]}`}
                    disabled={historyLoading || attendancePage <= 1}
                    onClick={() => setAttendancePage((page) => page - 1)}
                  >
                    Previous
                  </Button>
                  <span className={`${styles["form-hint"]}`}>
                    Page {data.attendancePagination.page} of{" "}
                    {data.attendancePagination.pages}
                  </span>
                  <Button
                    type="button"
                    className={`${styles["button-ghost"]}`}
                    disabled={
                      historyLoading ||
                      attendancePage >= data.attendancePagination.pages
                    }
                    onClick={() => setAttendancePage((page) => page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </Panel>
            <Panel title="Payment history">
              <div className={`${styles["table-wrap"]}`}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Diya</th>
                      <th>Liya</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((item) => (
                      <tr key={item._id}>
                        <td>{date(item.paidOn)}</td>
                        <td>
                          <Status
                            tone={
                              item.flow === "INFLOW"
                                ? "green"
                                : item.kind === "ADVANCE"
                                  ? "amber"
                                  : "teal"
                            }
                          >
                            {item.flow === "INFLOW"
                              ? `Liya · ${item.kind.replace("_", " ")}`
                              : item.kind.replace("_", " ")}
                          </Status>
                        </td>
                        <td
                          className={
                            item.flow === "INFLOW"
                              ? styles["income"]
                              : styles["amount"]
                          }
                        >
                          {item.flow === "INFLOW" ? "—" : money(item.amount)}
                        </td>
                        <td className={`${styles["income"]}`}>
                          {item.flow === "INFLOW" ? money(item.amount) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.payments.length && <Empty title="No payments" />}
              </div>
            </Panel>
          </div>
        </>
      )}
    </Modal>
  );
}

export function WorkersPage() {
  const type = "LABOUR";
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [ppeFilter, setPpeFilter] = useState("");
  const [workerPage, setWorkerPage] = useState(1);
  const [workersPerPage, setWorkersPerPage] = useState(10);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState();
  const [deleting, setDeleting] = useState();
  const [deletedWorkers, setDeletedWorkers] = useState([]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState();
  const [history, setHistory] = useState();
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [pdfColumnPickerOpen, setPdfColumnPickerOpen] = useState(false);
  const [selectedPdfColumns, setSelectedPdfColumns] = useState([
    "companyName",
    "teamName",
    "workZone",
    "active",
    "totalPayable",
  ]);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const load = () =>
    request(
      api.get("/workers", {
        params: { type },
      }),
    )
      .then(({ workers: result }) => setWorkers(result))
      .catch((err) => setError(errorMessage(err)));
  const loadDeletedWorkers = () =>
    request(api.get("/workers/deleted"))
      .then(({ workers: result }) => setDeletedWorkers(result || []))
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [type]);
  const optionsFor = (field) =>
    [...new Set(workers.map((worker) => worker[field]?.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
  const companyOptions = useMemo(() => optionsFor("companyName"), [workers]);
  const teamOptions = useMemo(() => optionsFor("teamName"), [workers]);
  const zoneOptions = useMemo(() => optionsFor("workZone"), [workers]);
  const filteredWorkers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return workers.filter((worker) => {
      const labourStatus =
        worker.labourStatus || (worker.active ? "ACTIVE" : "INACTIVE");
      if (statusFilter && labourStatus !== statusFilter) {
        return false;
      }
      if (companyFilter && worker.companyName !== companyFilter) return false;
      if (teamFilter && worker.teamName !== teamFilter) return false;
      if (zoneFilter && worker.workZone !== zoneFilter) return false;
      if (ppeFilter && Boolean(worker.ppeKitIssuedOn) !== (ppeFilter === "issued")) {
        return false;
      }
      if (!query) return true;
      return [
        worker.name,
        worker.phone,
        worker.companyName,
        worker.teamName,
        worker.workZone,
        worker.skill,
      ].some((value) => String(value || "").toLocaleLowerCase().includes(query));
    });
  }, [
    workers,
    search,
    statusFilter,
    companyFilter,
    teamFilter,
    zoneFilter,
    ppeFilter,
  ]);
  useEffect(() => {
    setWorkerPage(1);
  }, [search, statusFilter, companyFilter, teamFilter, zoneFilter, ppeFilter]);
  const workerPageCount = Math.max(
    1,
    Math.ceil(filteredWorkers.length / workersPerPage),
  );
  const currentWorkerPage = Math.min(workerPage, workerPageCount);
  const pagedWorkers = filteredWorkers.slice(
    (currentWorkerPage - 1) * workersPerPage,
    currentWorkerPage * workersPerPage,
  );
  const activeFilterCount = [
    statusFilter,
    companyFilter,
    teamFilter,
    zoneFilter,
    ppeFilter,
    search.trim(),
  ].filter(Boolean).length;
  const workforceMetrics = useMemo(() => {
    const activeCount = filteredWorkers.filter(
      (worker) =>
        (worker.labourStatus || (worker.active ? "ACTIVE" : "INACTIVE")) ===
        "ACTIVE",
    ).length;
    const wentHomeCount = filteredWorkers.filter(
      (worker) => worker.labourStatus === "WENT_HOME",
    ).length;
    const ppeCount = filteredWorkers.filter(
      (worker) => worker.ppeKitIssuedOn,
    ).length;
    const rateTotal = filteredWorkers.reduce(
      (total, worker) => total + (Number(worker.defaultDailyRate) || 0),
      0,
    );
    return {
      total: filteredWorkers.length,
      active: activeCount,
      inactive: filteredWorkers.length - activeCount - wentHomeCount,
      wentHome: wentHomeCount,
      ppe: ppeCount,
      noPpe: filteredWorkers.length - ppeCount,
      averageRate: filteredWorkers.length
        ? Math.round(rateTotal / filteredWorkers.length)
        : 0,
    };
  }, [filteredWorkers]);
  const save = (worker) => {
    setForm(false);
    setEditing(null);
    setHistory((current) =>
      current?._id === worker._id ? { ...current, ...worker } : current,
    );
    setWorkers((current) =>
      current.some((item) => item._id === worker._id)
        ? current.map((item) =>
            item._id === worker._id
              ? {
                  ...item,
                  ...worker,
                  totalPayable: worker.totalPayable ?? item.totalPayable,
                  totalPaid: worker.totalPaid ?? item.totalPaid,
                  totalReturned: worker.totalReturned ?? item.totalReturned,
                  netPaid: worker.netPaid ?? item.netPaid,
                  totalDue: worker.totalDue ?? item.totalDue,
                  overpaid: worker.overpaid ?? item.overpaid,
                }
              : item,
          )
        : [worker, ...current],
    );
    load();
  };
  const exportExcel = async () => {
    setExporting(true);
    setError("");
    try {
      const { buildWorkforceWorkbook } = await import(
        "../utils/workforceExcel.js"
      );
      const workbook = buildWorkforceWorkbook(
        filteredWorkers,
        exportColumns,
        exportValue,
      );
      const blob = new Blob([workbook], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type.toLowerCase()}-workforce.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };
  const exportPdf = async () => {
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      setError("Allow pop-ups to generate the workforce PDF.");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const companyData = await request(api.get("/company-profile")).catch(
        () => null,
      );
      printWorkers(
        filteredWorkers,
        type,
        companyData?.profile || null,
        selectedPdfColumns,
        printWindow,
      );
      setPdfColumnPickerOpen(false);
    } catch (err) {
      printWindow.close();
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };
  const workforceActions = (
    <div className={styles["workforce-export-actions"]}>
      <Button
        icon={Download}
        className={styles["button-excel"]}
        onClick={exportExcel}
        loading={exporting}
      >
        Excel
      </Button>
      <Button
        icon={Printer}
        className={styles["button-pdf"]}
        onClick={() => setPdfColumnPickerOpen(true)}
        disabled={exporting}
      >
        PDF
      </Button>
      <Button
        className={styles["button-secondary"]}
        onClick={() => {
          setShowRecycleBin((current) => !current);
          if (!showRecycleBin) loadDeletedWorkers();
        }}
        icon={Trash2}
      >
        Recycle bin
      </Button>
      <AddButton
        className={styles["button-primary"]}
        onClick={() => setForm(true)}
      >
        Add {typeTitle(type)}
      </AddButton>
      <Button
        icon={FilePlus2}
        className={styles["button-secondary"]}
        onClick={() => setBulkUploadOpen(true)}
      >
        Bulk upload labour
      </Button>
    </div>
  );
  return (
    <>
      <PageHeader
        className={styles["workforce-page-header"]}
        title="Labour workforce management"
      />
      {showRecycleBin && (
        <Panel
          title="Recycle bin"
          detail="Deleted workforce records stay here until you restore them."
        >
          <div className={`${styles["table-wrap"]}`}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Deleted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {deletedWorkers.length ? (
                  deletedWorkers.map((worker) => (
                    <tr key={worker._id}>
                      <td>
                        <strong>{worker.name}</strong>
                        <small>
                          Labour
                        </small>
                      </td>
                      <td>{date(worker.deletedAt)}</td>
                      <td>
                        <div className={`${styles["actions-inline"]}`}>
                          <Button
                            className={`${styles["button-secondary"]}`}
                            onClick={async () => {
                              await request(
                                api.patch(`/workers/${worker._id}/restore`),
                              );
                              await Promise.all([load(), loadDeletedWorkers()]);
                            }}
                          >
                            Restore
                          </Button>
                          <Button
                            className={`${styles["button-danger"]}`}
                            onClick={() => setPermanentlyDeleting(worker)}
                          >
                            Delete permanently
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3">
                      <Empty
                        title="Recycle bin empty"
                        detail="No deleted workforce records yet."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Panel
        title="Labour filters"
        detail="Filter by status, company, team, work zone or PPE."
        action={workforceActions}
        className={styles["workforce-controls-panel"]}
      >
        <div className={styles["workforce-filter-grid"]}>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search name, phone, skill…"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Worker status filter"
          >
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="WENT_HOME">Went Home</option>
          </select>
          <select
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
            aria-label="Company filter"
          >
            <option value="">All companies</option>
            {companyOptions.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
          <select
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            aria-label="Team filter"
          >
            <option value="">All teams</option>
            {teamOptions.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
          <select
            value={zoneFilter}
            onChange={(event) => setZoneFilter(event.target.value)}
            aria-label="Work zone filter"
          >
            <option value="">All work zones</option>
            {zoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          <select
            value={ppeFilter}
            onChange={(event) => setPpeFilter(event.target.value)}
            aria-label="PPE filter"
          >
            <option value="">All PPE records</option>
            <option value="issued">PPE issued</option>
            <option value="missing">PPE not issued</option>
          </select>
          {activeFilterCount > 0 && (
            <Button
              type="button"
              className={styles["button-ghost"]}
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setCompanyFilter("");
                setTeamFilter("");
                setZoneFilter("");
                setPpeFilter("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <div className={styles["workforce-summary"]}>
          <div className={styles["workforce-summary-heading"]}>
            <strong>Workforce overview</strong>
            <span>
              {filteredWorkers.length} of {workers.length} labour records
            </span>
          </div>
          <div
            className={`${styles["metric-grid"]} ${styles["workforce-metrics"]}`}
            aria-label="Filtered workforce summary"
          >
            <Metric
              label="Total labour"
              value={number(workforceMetrics.total)}
              detail="Matching filters"
              icon={UsersRound}
              tone="blue"
            />
            <Metric
              label="Active labour"
              value={number(workforceMetrics.active)}
              detail="Currently active"
              icon={UserRoundCheck}
              tone="green"
            />
            <Metric
              label="Inactive labour"
              value={number(workforceMetrics.inactive)}
              detail="Currently inactive"
              icon={UserRoundX}
              tone="coral"
            />
            <Metric
              label="Went home"
              value={number(workforceMetrics.wentHome)}
              detail="No new attendance or payments"
              icon={UserRoundX}
              tone="amber"
            />
            <Metric
              label="Labour with PPE"
              value={number(workforceMetrics.ppe)}
              detail="PPE issue recorded"
              icon={ShieldCheck}
              tone="teal"
            />
            <Metric
              label="Labour without PPE"
              value={number(workforceMetrics.noPpe)}
              detail="No PPE issue date"
              icon={ShieldAlert}
              tone="amber"
            />
            <Metric
              label="Avg. daily rate"
              value={money(workforceMetrics.averageRate)}
              detail="Across filtered labour"
              icon={IndianRupee}
              tone="purple"
            />
          </div>
        </div>
      </Panel>
      <Panel
        title={`Labour list (${filteredWorkers.length})`}
        detail="Manage labour profiles, rates, work history and payment status."
        className={styles["workforce-list-panel"]}
      >
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>{typeTitle(type)}</th>
                <th>Company</th>
                <th>Team</th>
                <th>Photo</th>
                <th>Contact</th>
                <th>Skill</th>
                <th>Work zone</th>
                <th>PPE given</th>
                <th>Default rate</th>
                <th>OT / hour</th>
                <th>Status</th>
                <th>Payable</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagedWorkers.map((worker) => (
                <tr
                  key={worker._id}
                  className={
                    (worker.labourStatus ||
                      (worker.active ? "ACTIVE" : "INACTIVE")) === "ACTIVE"
                      ? styles["worker-active"]
                      : worker.labourStatus === "WENT_HOME"
                        ? styles["worker-went-home"]
                        : styles["worker-inactive"]
                  }
                >
                  <td>
                    <strong>{worker.name}</strong>
                    <small>Joined {date(worker.joiningDate)}</small>
                  </td>
                  <td>{worker.companyName || "—"}</td>
                  <td>{worker.teamName || "—"}</td>
                  <td>
                    {worker.photoPath ? (
                      <img
                        src={imageUrl(worker, "photoUrl", "photoPath")}
                        alt={`${worker.name} profile`}
                        width="42"
                        height="42"
                        style={{ objectFit: "cover", borderRadius: "50%" }}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{worker.phone || "—"}</td>
                  <td>{worker.skill || "—"}</td>
                  <td>
                    {worker.workZone ? (
                      <span className={styles["zone-tag"]}>
                        {worker.workZone}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {worker.ppeKitIssuedOn ? date(worker.ppeKitIssuedOn) : "—"}
                  </td>
                  <td className={`${styles["amount"]}`}>
                    {money(worker.defaultDailyRate)}/day
                  </td>
                  <td className={`${styles["amount"]}`}>
                    {money(worker.overtimeHourlyRate || 0)}/hr
                  </td>
                  <td>
                    <Status
                      tone={
                        (worker.labourStatus ||
                          (worker.active ? "ACTIVE" : "INACTIVE")) === "ACTIVE"
                          ? "green"
                          : worker.labourStatus === "WENT_HOME"
                            ? "amber"
                            : "coral"
                      }
                    >
                      {statusLabel(worker)}
                    </Status>
                  </td>
                  <td>
                    <strong
                      className={
                        worker.totalDue > 0
                          ? styles["payment-due"]
                          : styles["payment-settled"]
                      }
                    >
                      {money(worker.totalDue || 0)}
                    </strong>
                    <small>
                      Total payable {money(worker.totalPayable || 0)}
                    </small>
                    <small>Net paid {money(worker.netPaid ?? worker.totalPaid ?? 0)}</small>
                    {(worker.overpaid || 0) > 0 && (
                      <small className={`${styles["payment-extra"]}`}>
                        +{money(worker.overpaid)} extra paid
                      </small>
                    )}
                  </td>
                  <td className={`${styles["actions"]}`}>
                    <button
                      className={`${styles["icon-button"]}`}
                      title="View history"
                      onClick={() => setHistory(worker)}
                    >
                      <Eye size={17} />
                    </button>
                    <button
                      className={`${styles["icon-button"]}`}
                      title="Edit worker"
                      onClick={() => setEditing(worker)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className={`${styles["icon-button"]} ${styles["delete-button"]}`}
                      title="Delete worker"
                      onClick={() => setDeleting(worker)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredWorkers.length && (
                <tr>
                  <td colSpan="13">
                    <Empty
                      title={
                        workers.length
                          ? "No labour matches these filters"
                          : "No labour records"
                      }
                      detail={
                        workers.length
                          ? "Try changing or clearing the selected filters."
                          : "Add your first labour record to get started."
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={styles["workforce-pagination"]}>
          <label>
            Show
            <select
              aria-label="Labour rows per page"
              value={workersPerPage}
              onChange={(event) => {
                setWorkersPerPage(Number(event.target.value));
                setWorkerPage(1);
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            entries
          </label>
          <span>
            {filteredWorkers.length
              ? `${(currentWorkerPage - 1) * workersPerPage + 1}–${Math.min(currentWorkerPage * workersPerPage, filteredWorkers.length)} of ${filteredWorkers.length}`
              : "0 entries"}
          </span>
          <div>
            <Button
              type="button"
              className={styles["button-ghost"]}
              disabled={currentWorkerPage <= 1}
              onClick={() => setWorkerPage(currentWorkerPage - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              className={styles["button-ghost"]}
              disabled={currentWorkerPage >= workerPageCount}
              onClick={() => setWorkerPage(currentWorkerPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Panel>
      {form && (
        <WorkerForm onClose={() => setForm(false)} onSaved={save} />
      )}{" "}
      {editing && (
        <WorkerForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={save}
        />
      )}{" "}
      {history && (
        <WorkerHistory worker={history} onClose={() => setHistory(null)} />
      )}
      {deleting && (
        <DeleteConfirm
          itemLabel={`${typeTitle(deleting.type)} ${deleting.name}`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request(api.delete(`/workers/${deleting._id}`));
            setWorkers((current) =>
              current.filter((item) => item._id !== deleting._id),
            );
            setDeletedWorkers((current) => [
              { ...deleting, deletedAt: new Date().toISOString() },
              ...current,
            ]);
            setDeleting(null);
          }}
        />
      )}
      {bulkUploadOpen && (
        <BulkWorkerUploadModal
          onClose={() => setBulkUploadOpen(false)}
          onCompleted={async () => {
            await load();
          }}
        />
      )}
      {permanentlyDeleting && (
        <DeleteConfirm
          itemLabel={`${typeTitle(permanentlyDeleting.type)} ${permanentlyDeleting.name}`}
          onClose={() => setPermanentlyDeleting(null)}
          onConfirm={async () => {
            await request(
              api.delete(`/workers/${permanentlyDeleting._id}/permanent`),
            );
            setDeletedWorkers((current) =>
              current.filter((item) => item._id !== permanentlyDeleting._id),
            );
            setPermanentlyDeleting(null);
          }}
        />
      )}
      {pdfColumnPickerOpen && (
        <Modal
          title="PDF mein kya dikhana hai?"
          onClose={() => !exporting && setPdfColumnPickerOpen(false)}
          wide
        >
          <div className={styles["worker-pdf-picker"]}>
            <p className={styles["worker-pdf-info"]}>
              Sr. No. and Labour Name are always included. Choose any other
              columns for this PDF.
            </p>
            <div className={styles["worker-pdf-column-heading"]}>
              <strong>Columns</strong>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPdfColumns(
                      pdfExportColumns.map(([, key]) => key),
                    )
                  }
                  disabled={exporting}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPdfColumns([])}
                  disabled={exporting}
                >
                  Clear Selection
                </button>
              </div>
            </div>
            <div className={styles["worker-pdf-required"]}>
              <label>
                <input type="checkbox" checked disabled readOnly />
                Sr. No. (required)
              </label>
              <label>
                <input type="checkbox" checked disabled readOnly />
                Labour Name (required)
              </label>
            </div>
            <div className={styles["worker-pdf-columns"]}>
              {pdfExportColumns.map(([label, key]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={selectedPdfColumns.includes(key)}
                    disabled={exporting}
                    onChange={(event) =>
                      setSelectedPdfColumns((current) =>
                        event.target.checked
                          ? [...current, key]
                          : current.filter((column) => column !== key),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className={styles["worker-pdf-note"]}>
              PDF will include {selectedPdfColumns.length + 2} columns and{" "}
              {filteredWorkers.length} matching labour records.
            </p>
            <div className={styles["modal-actions"]}>
              <Button
                type="button"
                className={styles["button-ghost"]}
                onClick={() => setPdfColumnPickerOpen(false)}
                disabled={exporting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                icon={Printer}
                className={styles["button-pdf"]}
                onClick={exportPdf}
                loading={exporting}
              >
                Generate PDF
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
