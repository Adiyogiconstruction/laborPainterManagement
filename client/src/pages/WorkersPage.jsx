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
  Download,
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
import companyLogo from "../assets/image.png";
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

const exportValue = (worker, key) => {
  if (key === "active") return worker.active ? "Active" : "Inactive";
  if (key === "joiningDate" || key === "ppeKitIssuedOn") {
    return worker[key] ? date(worker[key]) : "";
  }
  return worker[key] ?? "";
};

const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
const htmlValue = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function printWorkers(workers, type) {
  const printWindow = window.open("", "_blank", "width=1200,height=800");
  if (!printWindow) return;
  const headers = exportColumns.map(([label]) => `<th>${label}</th>`).join("");
  const rows = workers
    .map(
      (worker) =>
        `<tr>${exportColumns
          .map(
            ([, key]) =>
              `<td>${String(exportValue(worker, key)).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  printWindow.document.write(
    `<!doctype html><html><head><title>${typeTitle(type)} workforce</title><style>body{font-family:Arial,sans-serif;color:#192827}h1{font-size:20px;font-weight:600}p{color:#71817e;font-size:12px;font-weight:400}table{border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:9px;line-height:1.3;font-weight:400}th,td{border:1px solid #dce8e5;padding:5px;text-align:left;vertical-align:top;font-family:Arial,sans-serif;font-size:9px;line-height:1.3;font-weight:400}th{background:#e3f4f0}</style></head><body><h1>${typeTitle(type)} workforce</h1><p>${workers.length} records</p><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`,
  );
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
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
    `<!doctype html><html><head><title>${htmlValue(worker.name)} worker report</title><style>body{font-family:Arial,sans-serif;color:#192827;padding:24px}h1{margin:0 0 4px;font-size:22px}h2{margin:24px 0 8px;font-size:14px;border-bottom:1px solid #dce8e5;padding-bottom:6px}p{color:#71817e;font-size:11px;margin:4px 0}table{border-collapse:collapse;width:100%;font-size:10px;margin-top:8px}th,td{border:1px solid #dce8e5;padding:6px;text-align:left;vertical-align:top}th{background:#e3f4f0;text-transform:uppercase;font-size:9px}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:14px}.metric{border:1px solid #dce8e5;padding:9px}.metric strong{display:block;font-size:15px}.metric span{font-size:9px;color:#71817e}</style></head><body><h1>${htmlValue(worker.name)}</h1><p>${htmlValue(typeTitle(worker.type))} · ${htmlValue(worker.skill || "Worker")} · Report period: ${htmlValue(periodText)}</p><p>Phone: ${htmlValue(worker.phone)} · Team: ${htmlValue(worker.teamName || "—")} · Work zone: ${htmlValue(worker.workZone || "—")}</p><div class="summary"><div class="metric"><strong>${summary.days || 0}</strong><span>Attendance days</span></div><div class="metric"><strong>${summary.presentDays || 0}</strong><span>Present days</span></div><div class="metric"><strong>${summary.doubleDays || 0}</strong><span>Double-work days</span></div><div class="metric"><strong>${htmlValue(money(summary.totalPayable || 0))}</strong><span>Total payable</span></div><div class="metric"><strong>${htmlValue(money(summary.totalPaid || 0))}</strong><span>Paid</span></div></div><h2>Attendance</h2><table><thead><tr><th>Date</th><th>Site / work</th><th>Status</th><th>Units</th><th>Payable</th></tr></thead><tbody>${rows(data.attendance || [], [(item) => date(item.date), (item) => item.assignment?.siteName || "—", (item) => item.status, (item) => item.workUnits || 0, (item) => money(item.payableAmount || 0)])}</tbody></table><h2>Work assignments</h2><table><thead><tr><th>Site / client</th><th>Work</th><th>Start</th><th>Days</th><th>Status</th></tr></thead><tbody>${rows(data.assignments || [], [(item) => item.siteName, (item) => item.workDescription, (item) => date(item.startDate), (item) => item.workDays || 0, (item) => item.status])}</tbody></table><h2>Payment history</h2><table><thead><tr><th>Date</th><th>Type</th><th>Work record</th><th>Amount</th></tr></thead><tbody>${rows(data.payments || [], [(item) => date(item.paidOn), (item) => item.kind, (item) => item.assignment?.siteName || "—", (item) => money(item.amount)])}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`,
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

function WorkerForm({ type, initial, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial || {
      type,
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
      address: "",
      notes: "",
    },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState(null);
  const update = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!initial && (!aadhaarFrontFile || !aadhaarBackFile)) {
        throw new Error("Please select both Aadhaar front and back images.");
      }
      const { photoPath, photoUrl, ...workerFields } = form;
      const body = {
        ...workerFields,
        defaultDailyRate: Number(form.defaultDailyRate || 0),
        overtimeHourlyRate: Number(form.overtimeHourlyRate || 0),
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
      title={`${initial ? "Edit" : "Add"} ${typeTitle(type)}`}
      onClose={onClose}
      wide
    >
      <form
        className={`${styles["form-grid"]} ${styles["three-col"]}`}
        onSubmit={save}
      >
        <Field label="Full name">
          <input
            required
            autoFocus
            value={form.name}
            onChange={update("name")}
            placeholder="Worker name"
          />
        </Field>
        <Field label="Company name" hint="Optional">
          <input
            value={form.companyName || ""}
            onChange={update("companyName")}
            placeholder="Company name"
          />
        </Field>
        {type === "LABOUR" && (
          <Field label="Labour team" hint="Optional">
            <input
              value={form.teamName || ""}
              onChange={update("teamName")}
              placeholder="e.g. Team A or Ramesh crew"
            />
          </Field>
        )}
        <Field label="Mobile number" hint="Required">
          <input
            required
            value={form.phone || ""}
            onChange={update("phone")}
            placeholder="Mobile number"
          />
        </Field>
        <Field label="Aadhaar number" hint="Required">
          <input
            required
            inputMode="numeric"
            pattern="[0-9]{12}"
            maxLength="12"
            value={form.aadhaarNumber || ""}
            onChange={update("aadhaarNumber")}
            placeholder="12-digit Aadhaar number"
          />
        </Field>
        <Field label="Skill / role" hint="Required">
          <input
            required
            value={form.skill || ""}
            onChange={update("skill")}
            placeholder={
              type === "PAINTER" ? "e.g. Wall painter" : "e.g. Mason helper"
            }
          />
        </Field>
        <Field label="Current work zone">
          <input
            list="worker-zones"
            value={form.workZone || ""}
            onChange={update("workZone")}
            placeholder="Mumbai Zone or another location"
          />
          <datalist id="worker-zones">
            <option value="Mumbai Zone" />
            <option value="Chennai Zone" />
            <option value="Other" />
          </datalist>
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
        <Field label="Aadhaar card - front" hint="Required for new workers">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            required={!initial && !form.aadhaarFrontPath}
            onChange={(event) =>
              setAadhaarFrontFile(event.target.files?.[0] || null)
            }
          />
          {form.aadhaarFrontPath && (
            <small>Existing front image will remain unless replaced.</small>
          )}
        </Field>
        <Field label="Aadhaar card - back" hint="Required for new workers">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            required={!initial && !form.aadhaarBackPath}
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
        <Field label="Default daily rate" hint="Required">
          <input
            required
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
        <Field label="Joining date" hint="Required">
          <input
            required
            type="date"
            value={inputDate(form.joiningDate || new Date())}
            onChange={update("joiningDate")}
          />
        </Field>
        <Field label="Status">
          <select
            value={String(form.active ?? true)}
            onChange={(e) =>
              setForm({ ...form, active: e.target.value === "true" })
            }
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>
        <Field label="Address" hint="Required">
          <input
            required
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
            Save {typeTitle(type)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function WorkerHistory({ worker, onClose }) {
  const [data, setData] = useState();
  const [companyProfile, setCompanyProfile] = useState();
  const [error, setError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [period, setPeriod] = useState(() =>
    monthBounds(new Date().toISOString().slice(0, 7)),
  );
  const [allTime, setAllTime] = useState(false);
  const [attendancePage, setAttendancePage] = useState(1);
  const attendanceLimit = 10;
  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setError("");
    Promise.all([
      request(
        api.get(`/workers/${worker._id}/history`, {
          params: {
            ...(allTime ? {} : period),
            attendancePage,
            attendanceLimit,
          },
        }),
      ),
      request(api.get("/company-profile")),
    ])
      .then(([historyData, profileData]) => {
        if (!active) return;
        setData(historyData);
        setCompanyProfile(profileData.profile);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [worker._id, period, allTime, attendancePage]);
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
  return (
    <Modal
      title={`${worker.name} · History`}
      onClose={onClose}
      wide
      action={
        <Button
          icon={Printer}
          className={`${styles["button-secondary"]}`}
          disabled={!data || !companyProfile}
          onClick={() => printWorkerOnboardingCompact(worker, companyProfile)}
        >
          PDF
        </Button>
      }
    >
      <ErrorNote error={error} />
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
                  label="Total payable"
                  value={money(data.attendanceSummary?.totalPayable || 0)}
                  tone="amber"
                />
                <Metric
                  label="Paid"
                  value={money(data.attendanceSummary?.totalPaid || 0)}
                  tone="blue"
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
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((item) => (
                      <tr key={item._id}>
                        <td>{date(item.paidOn)}</td>
                        <td>
                          <Status
                            tone={item.kind === "ADVANCE" ? "amber" : "teal"}
                          >
                            {item.kind.replace("_", " ")}
                          </Status>
                        </td>
                        <td className={`${styles["amount"]}`}>
                          {money(item.amount)}
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

export function WorkersPage({ businessType = "LABOUR" }) {
  const navigate = useNavigate();
  const type = businessType;
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState();
  const [deleting, setDeleting] = useState();
  const [deletedWorkers, setDeletedWorkers] = useState([]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [history, setHistory] = useState();
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const load = () =>
    request(
      api.get("/workers", {
        params: {
          type,
          search,
          ...(statusFilter !== ""
            ? { active: String(statusFilter === "active") }
            : {}),
        },
      }),
    )
      .then(({ workers: result }) => setWorkers(result))
      .catch((err) => setError(errorMessage(err)));
  const loadDeletedWorkers = () =>
    request(api.get("/workers/deleted"))
      .then(({ workers: result }) => setDeletedWorkers(result || []))
      .catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    const timer = setTimeout(load, search || statusFilter ? 250 : 0);
    return () => clearTimeout(timer);
  }, [type, search, statusFilter]);
  const save = (worker) => {
    setForm(false);
    setEditing(null);
    setWorkers((current) =>
      current.some((item) => item._id === worker._id)
        ? current.map((item) =>
            item._id === worker._id
              ? {
                  ...item,
                  ...worker,
                  totalPayable: worker.totalPayable ?? item.totalPayable,
                  totalPaid: worker.totalPaid ?? item.totalPaid,
                  totalDue: worker.totalDue ?? item.totalDue,
                  overpaid: worker.overpaid ?? item.overpaid,
                }
              : item,
          )
        : [worker, ...current],
    );
  };
  const getExportWorkers = async () => {
    const result = await request(api.get("/workers", { params: { type } }));
    return result.workers || [];
  };
  const exportExcel = async () => {
    setExporting(true);
    setError("");
    try {
      const records = await getExportWorkers();
      const csv = [
        exportColumns.map(([label]) => csvCell(label)).join(","),
        ...records.map((worker) =>
          exportColumns
            .map(([, key]) => csvCell(exportValue(worker, key)))
            .join(","),
        ),
      ].join("\r\n");
      const blob = new Blob([`\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type.toLowerCase()}-workforce.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };
  const exportPdf = async () => {
    setExporting(true);
    setError("");
    try {
      printWorkers(await getExportWorkers(), type);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow={type === "PAINTER" ? "PAINTER TEAM" : "LABOUR TEAM"}
        title={
          type === "PAINTER"
            ? "Painter workforce management"
            : "Labour workforce management"
        }
        detail={
          type === "PAINTER"
            ? "Maintain complete painter profiles, daily rates and work history separately from labour."
            : "Maintain complete labour profiles, daily rates and work history separately from painters."
        }
        action={
          <div className={`${styles["actions-inline"]}`}>
            <Button
              icon={Download}
              className={`${styles["button-secondary"]}`}
              onClick={exportExcel}
              loading={exporting}
            >
              Excel
            </Button>
            <Button
              icon={Printer}
              className={`${styles["button-secondary"]}`}
              onClick={exportPdf}
              disabled={exporting}
            >
              PDF
            </Button>
            <Button
              className={`${styles["button-secondary"]}`}
              onClick={() => {
                setShowRecycleBin((current) => !current);
                if (!showRecycleBin) loadDeletedWorkers();
              }}
              icon={Trash2}
            >
              Recycle bin
            </Button>
            <AddButton
              className={`${styles["button-primary"]}`}
              onClick={() => setForm(true)}
            >
              Add {typeTitle(type)}
            </AddButton>
          </div>
        }
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
                          {worker.type === "PAINTER" ? "Painter" : "Labour"}
                        </small>
                      </td>
                      <td>{date(worker.deletedAt)}</td>
                      <td>
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
        action={
          <div className={`${styles["toolbar"]} ${styles["filter-bar"]}`}>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder={
                type === "LABOUR"
                  ? "Search labour by name, company, team or work zone…"
                  : "Search painter by name or work zone…"
              }
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Worker status filter"
            >
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        }
      >
        <ErrorNote error={error} />
        <div className={`${styles["table-wrap"]}`}>
          <table>
            <thead>
              <tr>
                <th>{typeTitle(type)}</th>
                {type === "LABOUR" && <th>Company</th>}
                {type === "LABOUR" && <th>Team</th>}
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
              {workers.map((worker) => (
                <tr
                  key={worker._id}
                  className={
                    worker.active
                      ? styles["worker-active"]
                      : styles["worker-inactive"]
                  }
                >
                  <td>
                    <strong>{worker.name}</strong>
                    <small>Joined {date(worker.joiningDate)}</small>
                  </td>
                  {type === "LABOUR" && <td>{worker.companyName || "—"}</td>}
                  {type === "LABOUR" && <td>{worker.teamName || "—"}</td>}
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
                  <td>{worker.workZone || "—"}</td>
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
                    <Status tone={worker.active ? "teal" : "neutral"}>
                      {worker.active ? "Active" : "Inactive"}
                    </Status>
                  </td>
                  <td>
                    <strong>{money(worker.totalDue || 0)}</strong>
                    <small>
                      Total payable {money(worker.totalPayable || 0)}
                    </small>
                    <small>Paid {money(worker.totalPaid || 0)}</small>
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
                      <History size={17} />
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
              {!workers.length && (
                <tr>
                  <td colSpan={type === "LABOUR" ? 12 : 11}>
                    <Empty
                      title={`No ${type.toLowerCase()} records`}
                      detail={`Add your first ${type.toLowerCase()} to get started.`}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {form && (
        <WorkerForm type={type} onClose={() => setForm(false)} onSaved={save} />
      )}{" "}
      {editing && (
        <WorkerForm
          type={type}
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
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
