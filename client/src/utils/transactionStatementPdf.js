import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const margin = 10;

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid statement date.");
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const formatAmount = (value) =>
  `Rs. ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))}`;

const paymentDetails = (payment) =>
  [
    String(payment.kind || "TRANSACTION").replaceAll("_", " "),
    payment.method,
    payment.reference,
    payment.notes,
  ]
    .filter(Boolean)
    .join(" · ");

export function summarizeTransactions(payments) {
  if (!Array.isArray(payments)) {
    throw new Error("Transaction entries are required for the statement.");
  }
  const totals = payments.reduce(
    (summary, payment, index) => {
      if (!payment || !["OUTFLOW", "INFLOW"].includes(payment.flow)) {
        throw new Error(`Transaction ${index + 1} has an invalid flow.`);
      }
      const amount = Number(payment.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`Transaction ${index + 1} has an invalid amount.`);
      }
      if (payment.flow === "OUTFLOW") summary.debit += amount;
      else summary.credit += amount;
      return summary;
    },
    { debit: 0, credit: 0 },
  );
  return {
    ...totals,
    net: totals.debit - totals.credit,
    entries: payments.length,
  };
}

export function createTransactionStatementPdf({
  profile,
  from,
  to,
  payments,
}) {
  if (!profile?.companyName?.trim()) {
    throw new Error("Company profile name is required for the statement.");
  }
  if (!Array.isArray(payments)) {
    throw new Error("Transaction entries are required for the statement.");
  }
  const startDate = formatDate(`${from}T00:00:00`);
  const endDate = formatDate(`${to}T00:00:00`);
  const summary = summarizeTransactions(payments);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const companyDetails = [
    profile.address,
    [profile.mobile, profile.email].filter(Boolean).join(" · "),
    profile.gstin ? `GSTIN: ${profile.gstin}` : "",
  ].filter(Boolean);

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(29, 55, 49);
    doc.text(profile.companyName.trim(), margin, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(83, 102, 96);
    let detailY = 21;
    for (const line of companyDetails) {
      const wrapped = doc.splitTextToSize(line, contentWidth);
      doc.text(wrapped, margin, detailY);
      detailY += wrapped.length * 3.5;
    }
    const titleY = Math.max(31, detailY + 3);
    doc.setDrawColor(27, 132, 105);
    doc.setLineWidth(0.7);
    doc.line(margin, titleY - 4, pageWidth - margin, titleY - 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(29, 55, 49);
    doc.text("ACCOUNT STATEMENT", margin, titleY + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(83, 102, 96);
    doc.text(`${startDate} – ${endDate}`, pageWidth - margin, titleY + 2, {
      align: "right",
    });
    return titleY + 8;
  };

  const summaryY = drawHeader();
  const cards = [
    { label: "TOTAL DEBIT · PAID OUT", value: summary.debit, color: [183, 68, 63] },
    { label: "TOTAL CREDIT · RECEIVED", value: summary.credit, color: [24, 125, 96] },
    {
      label: `NET BALANCE · ${summary.net >= 0 ? "DR" : "CR"}`,
      value: Math.abs(summary.net),
      color: [42, 72, 112],
    },
    { label: "NO. OF ENTRIES", value: summary.entries, color: [69, 84, 80], isCount: true },
  ];
  const cardGap = 3;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  cards.forEach((card, index) => {
    const x = margin + index * (cardWidth + cardGap);
    doc.setFillColor(246, 249, 248);
    doc.setDrawColor(218, 229, 225);
    doc.roundedRect(x, summaryY, cardWidth, 17, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.setTextColor(91, 108, 102);
    doc.text(card.label, x + 2, summaryY + 5);
    doc.setFontSize(9);
    doc.setTextColor(...card.color);
    doc.text(
      card.isCount ? String(card.value) : formatAmount(card.value),
      x + 2,
      summaryY + 12,
    );
  });

  const rows = payments.map((payment) => [
    formatDate(payment.paidOn),
    payment.worker?.name || "Business expense",
    paymentDetails(payment) || "—",
    payment.flow === "OUTFLOW" ? formatAmount(payment.amount) : "—",
    payment.flow === "INFLOW" ? formatAmount(payment.amount) : "—",
  ]);
  autoTable(doc, {
    head: [["Date", "Name", "Details", "Debit (-)", "Credit (+)"]],
    body: rows.length ? rows : [["—", "—", "No transactions recorded.", "—", "—"]],
    startY: summaryY + 22,
    margin: { left: margin, right: margin, top: 40, bottom: 13 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
      lineColor: [220, 229, 226],
      textColor: [38, 53, 49],
      valign: "top",
    },
    headStyles: {
      fillColor: [34, 68, 60],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 23 },
      1: { cellWidth: 38 },
      2: { cellWidth: 70 },
      3: { cellWidth: 29, halign: "right", textColor: [165, 61, 57] },
      4: { cellWidth: 30, halign: "right", textColor: [24, 125, 96] },
    },
    didDrawPage() {
      if (doc.internal.getCurrentPageInfo().pageNumber > 1) drawHeader();
      const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setDrawColor(220, 229, 226);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(105, 119, 114);
      doc.text("Generated by Workforce Operations", margin, pageHeight - 6);
      doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 6, {
        align: "right",
      });
    },
  });
  return doc;
}

export function downloadTransactionStatementPdf(options) {
  const doc = createTransactionStatementPdf(options);
  doc.save(`account-statement-${options.from}-to-${options.to}.pdf`);
}
