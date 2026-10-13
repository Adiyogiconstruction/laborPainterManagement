import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { money } from "./formatters.js";

const rateLabel = (values = []) =>
  values.length
    ? [...new Set(values)].sort((left, right) => left - right).map(money).join(" / ")
    : "—";

export function downloadCompanyProfitPdf({ company, filters, rows, totals }) {
  if (!company?.name || !filters?.from || !filters?.to || !Array.isArray(rows)) {
    throw new Error("Company, report dates and labour rows are required.");
  }
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  const width = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(28, 48, 42);
  doc.text(company.name, margin, 16);
  doc.setFontSize(13);
  doc.text("LABOUR-WISE PROFIT SHEET", margin, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(82, 99, 93);
  doc.text(
    `Date: ${filters.from} to ${filters.to}   Zone: ${filters.zone}   Team: ${filters.team}   Labour: ${filters.labours}`,
    margin,
    31,
  );

  const body = rows.map((row) => [
    row.name,
    row.team,
    row.zone,
    row.days,
    row.overtimeHours,
    rateLabel(row.rates?.companyDaily),
    rateLabel(row.rates?.labourDaily),
    rateLabel(row.rates?.companyOvertime),
    rateLabel(row.rates?.labourOvertime),
    money(row.dutyProfit),
    money(row.overtimeProfit),
    money(Number(row.companyBilling || 0) - Number(row.labourSalary || 0)),
  ]);
  body.push([
    { content: "TOTAL", colSpan: 9, styles: { fontStyle: "bold" } },
    { content: money(totals.dutyProfit), styles: { fontStyle: "bold" } },
    { content: money(totals.overtimeProfit), styles: { fontStyle: "bold" } },
    { content: money(totals.margin), styles: { fontStyle: "bold" } },
  ]);
  autoTable(doc, {
    head: [[
      "Labour",
      "Team",
      "Zone",
      "Days",
      "OT hrs",
      "Company/day",
      "Labour/day",
      "Company OT/hr",
      "Labour OT/hr",
      "Duty profit",
      "OT profit",
      "Total profit",
    ]],
    body: body.length > 1 ? body : [["No labour activity", "", "", "", "", "", "", "", "", "", "", ""]],
    startY: 37,
    margin: { left: margin, right: margin, top: 12, bottom: 12 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
      lineColor: [218, 226, 224],
      textColor: [30, 42, 40],
    },
    headStyles: { fillColor: [20, 92, 72], textColor: [255, 255, 255] },
    didDrawPage() {
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 108);
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
        width - margin,
        doc.internal.pageSize.getHeight() - 6,
        { align: "right" },
      );
    },
  });
  const safeName = company.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  doc.save(`labour-profit-${safeName}-${filters.from}-to-${filters.to}.pdf`);
}
