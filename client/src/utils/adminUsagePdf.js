import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));

const formatDuration = (milliseconds) => {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
};

export function createAdminUsagePdf({ profile, filters, rows }) {
  if (!filters?.from || !filters?.to || !Array.isArray(rows)) {
    throw new Error("Usage report dates and activity rows are required.");
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const companyName = profile?.companyName?.trim() || "Company details not configured";
  const companyLines = [
    profile?.address,
    [profile?.mobile, profile?.email].filter(Boolean).join(" · "),
    [
      profile?.gstin ? `GSTIN: ${profile.gstin}` : "",
      profile?.pan ? `PAN: ${profile.pan}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  ].filter(Boolean);
  const totalActiveMilliseconds = rows.reduce(
    (total, row) => total + Number(row.activeMilliseconds || 0),
    0,
  );
  const totalInactiveMilliseconds = rows.reduce(
    (total, row) => total + Number(row.inactiveMilliseconds || 0),
    0,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(25, 39, 38);
  doc.text(companyName, margin, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(75, 89, 87);
  let headerY = 25;
  for (const line of companyLines) {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped, margin, headerY);
    headerY += wrapped.length * 4.5;
  }

  headerY += 3;
  doc.setDrawColor(255, 152, 51);
  doc.setLineWidth(0.8);
  doc.line(margin, headerY, pageWidth - margin, headerY);

  headerY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(25, 39, 38);
  doc.text("ADMIN ACCESS ACTIVITY REPORT", margin, headerY);

  headerY += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("FILTERS APPLIED", margin, headerY);
  headerY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(75, 89, 87);
  const appliedFilters = [
    `Date range: ${formatDate(filters.from)} to ${formatDate(filters.to)}`,
    `User: ${filters.adminName || "All users"}`,
  ];
  for (const filter of appliedFilters) {
    const wrapped = doc.splitTextToSize(filter, contentWidth);
    doc.text(wrapped, margin, headerY);
    headerY += wrapped.length * 3.5;
  }
  headerY += 3;

  const body = rows.map((row, index) => [
    String(index + 1),
    formatDate(row.date),
    row.userName,
    formatDuration(row.activeMilliseconds),
    formatDuration(row.inactiveMilliseconds),
  ]);
  body.push([
    "",
    {
      content: "Selected period total",
      colSpan: 2,
      styles: { fontStyle: "bold" },
    },
    {
      content: formatDuration(totalActiveMilliseconds),
      styles: { fontStyle: "bold", textColor: [25, 114, 67] },
    },
    {
      content: formatDuration(totalInactiveMilliseconds),
      styles: { fontStyle: "bold" },
    },
  ]);

  autoTable(doc, {
    head: [[
      "Sr. No.",
      "Date",
      "User name",
      "Active Time",
      "Non-active Time",
    ]],
    body:
      rows.length > 0
        ? body
        : [["—", "—", "No activity recorded.", "—", "—"]],
    startY: headerY,
    margin: { left: margin, right: margin, top: 14, bottom: 14 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      lineColor: [218, 226, 224],
      textColor: [30, 42, 40],
      valign: "top",
    },
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 34 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 37, halign: "right", textColor: [25, 114, 67] },
      4: { cellWidth: 37, halign: "right" },
    },
    didParseCell(data) {
      if (rows.length > 0 && data.row.index === rows.length && data.section === "body") {
        data.cell.styles.fillColor = [246, 248, 247];
      }
    },
    didDrawPage() {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 108);
      doc.text(
        `Generated ${new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date())}`,
        margin,
        pageHeight - 7,
      );
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
        pageWidth - margin,
        pageHeight - 7,
        { align: "right" },
      );
    },
  });

  return doc;
}

export function downloadAdminUsagePdf(options) {
  const doc = createAdminUsagePdf(options);
  const safeName = (options.filters.adminName || "all-administrators")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  doc.save(
    `admin-usage-${safeName}-${options.filters.from}-to-${options.filters.to}.pdf`,
  );
}
