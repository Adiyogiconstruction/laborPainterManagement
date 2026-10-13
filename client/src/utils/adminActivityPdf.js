import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";

export function createAdminActivityPdf({
  user,
  profile,
  activities,
  filters = {},
}) {
  if (!user?.name || !user?.email || !Array.isArray(activities)) {
    throw new Error("Administrator details and activity history are required.");
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const companyName = profile?.companyName || "Company details not configured";
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(25, 39, 38);
  doc.text(companyName, margin, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(75, 89, 87);
  let headerY = 25;
  for (const line of companyLines) {
    const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
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
  doc.text("ADMIN ACTIVITY HISTORY", margin, headerY);

  headerY += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Administrator: ${user.name}`, margin, headerY);
  headerY += 5;
  doc.text(`Email: ${user.email}   Role: ${user.role || "ADMIN"}`, margin, headerY);
  headerY += 5;
  doc.text(
    `Account: ${user.active === false ? "Disabled" : "Active"}   Activities: ${activities.length}`,
    margin,
    headerY,
  );
  headerY += 7;

  const formatFilterDate = (value) =>
    value
      ? new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${value}T00:00:00.000Z`))
      : "";
  const appliedFilters = [
    `Administrator: ${user.name}`,
    `Activity: ${filters.activity ? filters.activity.replaceAll("_", " ") : "All activities"}`,
    `Date range: ${
      filters.fromDate || filters.toDate
        ? `${formatFilterDate(filters.fromDate) || "Any"} to ${formatFilterDate(filters.toDate) || "Any"}`
        : "All dates"
    }`,
    `Search: ${filters.search || "None"}`,
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(25, 39, 38);
  doc.text("FILTERS APPLIED", margin, headerY);
  headerY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(75, 89, 87);
  for (const filter of appliedFilters) {
    const wrapped = doc.splitTextToSize(filter, pageWidth - margin * 2);
    doc.text(wrapped, margin, headerY);
    headerY += wrapped.length * 3.5;
  }
  headerY += 3;

  const rows = activities.map((activity) => {
    const context = Object.entries(activity.meta || {})
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
      .join("\n");
    return [
      formatDateTime(activity.createdAt),
      String(activity.action || "ACTIVITY").replaceAll("_", " "),
      [activity.message || "—", context ? `Context: ${context}` : ""]
        .filter(Boolean)
        .join("\n"),
    ];
  });

  autoTable(doc, {
    head: [["Date & time", "Action", "Details"]],
    body: rows.length ? rows : [["—", "—", "No activity recorded."]],
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
      0: { cellWidth: 39 },
      1: { cellWidth: 34 },
      2: { cellWidth: "auto" },
    },
    didDrawPage() {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 108);
      doc.text(
        `Generated ${formatDateTime(new Date())}`,
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

export function downloadAdminActivityPdf(options) {
  const doc = createAdminActivityPdf(options);
  const safeName = options.user.name
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  doc.save(`admin-activity-${safeName || "administrator"}.pdf`);
}
