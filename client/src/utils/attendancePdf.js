import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const pageWidthMm = 297;
const pageHeightMm = 210;
const marginMm = 5;
const dayColumnWidthMm = 4.54;
const headerTopMm = 7;
const headerHeightMm = 14;

export const attendancePdfLayout = Object.freeze({
  pageWidthMm,
  pageHeightMm,
  marginMm,
  dayColumnWidthMm,
  fixedColumnWidthsMm: Object.freeze([7, 38, 24, 23, 34, 20]),
});

export const attendanceDaysInMonth = (month) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")) {
    throw new Error("Select a valid attendance month before generating PDF.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
};

const columnWidthsForDays = (dayCount) => [
  ...attendancePdfLayout.fixedColumnWidthsMm.slice(0, 4),
  ...Array(dayCount).fill(dayColumnWidthMm),
  ...attendancePdfLayout.fixedColumnWidthsMm.slice(4),
];

export function validateAttendancePdfData({ month, workers }) {
  const dayCount = attendanceDaysInMonth(month);
  if (!Array.isArray(workers) || workers.length === 0) {
    throw new Error("No workers match the selected attendance filters.");
  }
  workers.forEach((worker, index) => {
    if (
      !worker ||
      typeof worker.serialNumber !== "number" ||
      typeof worker.workerName !== "string" ||
      !worker.workerName.trim() ||
      !Array.isArray(worker.attendance) ||
      worker.attendance.length !== dayCount ||
      !worker.attendance.every((code) => typeof code === "string") ||
      !["string", "number"].includes(typeof worker.totalDH) ||
      !["string", "number"].includes(typeof worker.totalDays)
    ) {
      throw new Error(`Attendance data is incomplete for row ${index + 1}.`);
    }
  });

  const columnWidthsMm = columnWidthsForDays(dayCount);
  const tableWidthMm = columnWidthsMm.reduce(
    (total, width) => total + width,
    0,
  );
  const printableWidthMm = pageWidthMm - marginMm * 2;
  if (tableWidthMm > printableWidthMm) {
    throw new Error("Attendance PDF columns exceed the printable page width.");
  }
  return { tableWidthMm, printableWidthMm, dayCount, columnWidthsMm };
}

const toImageData = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Unable to prepare the company logo for PDF."));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Unable to load the company logo."));
    image.src = src;
  });

async function resolveLogo(profileLogoUrl, fallbackLogoUrl) {
  if (profileLogoUrl) {
    try {
      return await toImageData(profileLogoUrl);
    } catch {
      return toImageData(fallbackLogoUrl);
    }
  }
  return toImageData(fallbackLogoUrl);
}

const formatMonth = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
};

export async function createAttendancePdf({
  month,
  team,
  companyName,
  workers,
  profileLogoUrl,
  fallbackLogoUrl,
}) {
  const {
    tableWidthMm,
    printableWidthMm,
    dayCount,
    columnWidthsMm,
  } = validateAttendancePdfData({ month, workers });
  const logoData = await resolveLogo(profileLogoUrl, fallbackLogoUrl);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  if (
    Math.abs(doc.internal.pageSize.getWidth() - pageWidthMm) > 0.1 ||
    Math.abs(doc.internal.pageSize.getHeight() - pageHeightMm) > 0.1
  ) {
    throw new Error("Unable to create an A4 landscape attendance PDF.");
  }

  const headers = [
    "SR.NO",
    "WORKERS NAME",
    "COMPANY",
    "LOCATION",
    ...Array.from({ length: dayCount }, (_, index) =>
      String(index + 1),
    ),
    "TOTAL (D + H)",
    "TOTAL DAYS",
  ];
  if (headers.length !== columnWidthsMm.length) {
    throw new Error(`Attendance PDF must contain ${dayCount} day columns and both totals.`);
  }
  const rows = workers.map((worker) => [
    String(worker.serialNumber),
    worker.workerName,
    worker.company || "-",
    worker.location || "-",
    ...worker.attendance,
    worker.totalDH,
    worker.totalDays,
  ]);
  const grandTotal = workers.reduce(
    (total, worker) => total + Number(worker.totalDaysValue || 0),
    0,
  );
  rows.push([
    {
      content: "AGGREGATE TOTAL DAYS",
      colSpan: headers.length - 1,
      styles: {
        halign: "right",
        fillColor: [255, 255, 255],
        fontStyle: "bold",
      },
    },
    {
      content: grandTotal.toFixed(3),
      styles: {
        fillColor: [222, 240, 222],
        fontStyle: "bold",
      },
    },
  ]);

  const widths = columnWidthsMm;
  const firstDayColumn = 4;
  const lastDayColumn = firstDayColumn + dayCount - 1;
  const firstTotalColumn = lastDayColumn + 1;
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: headerTopMm + headerHeightMm + 1,
    margin: {
      top: headerTopMm + headerHeightMm + 1,
      right: marginMm,
      bottom: 7,
      left: marginMm,
    },
    tableWidth: tableWidthMm,
    showHead: "everyPage",
    rowPageBreak: "avoid",
    pageBreak: "auto",
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 4.2,
      cellPadding: 0.22,
      minCellHeight: 4.7,
      overflow: "ellipsize",
      lineColor: [90, 90, 90],
      lineWidth: 0.12,
      textColor: [25, 25, 25],
      valign: "middle",
    },
    headStyles: {
      fillColor: [230, 239, 229],
      textColor: [25, 25, 25],
      fontStyle: "bold",
      halign: "center",
      minCellHeight: 5.2,
    },
    columnStyles: Object.fromEntries(
      widths.map((cellWidth, index) => [
        index,
        {
          cellWidth,
          halign: index === 1 || index === 2 || index === 3 ? "left" : "center",
        },
      ]),
    ),
    didParseCell({ section, column, cell }) {
      if (
        section === "body" &&
        column.index >= 1 &&
        column.index < headers.length - 1 &&
        typeof cell.raw === "string" &&
        cell.raw
      ) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(4.2);
        const availableWidth = widths[column.index] - 0.5;
        const textWidth = doc.getTextWidth(cell.raw);
        if (textWidth > availableWidth) {
          cell.styles.fontSize = Math.max(
            column.index >= firstDayColumn && column.index <= lastDayColumn
              ? 2.8
              : 3.4,
            4.2 * (availableWidth / textWidth),
          );
        }
      }
      if (
        section === "body" &&
        column.index >= firstDayColumn &&
        column.index <= lastDayColumn
      ) {
        if (cell.raw === "A") {
          cell.styles.fillColor = [255, 194, 194];
        } else {
          cell.styles.fillColor = [255, 255, 255];
        }
      }
      if (section === "body" && column.index >= firstTotalColumn) {
        cell.styles.fillColor = [222, 240, 222];
        cell.styles.fontStyle = "bold";
      }
    },
    willDrawPage() {
      const brandEndMm = 137;
      const recipientEndMm = 203;
      const monthEndMm = pageWidthMm - marginMm;
      doc.setDrawColor(80, 80, 80);
      doc.setLineWidth(0.2);
      doc.rect(marginMm, headerTopMm, brandEndMm - marginMm, headerHeightMm);
      doc.rect(brandEndMm, headerTopMm, recipientEndMm - brandEndMm, headerHeightMm);
      doc.setFillColor(235, 242, 250);
      doc.rect(
        recipientEndMm,
        headerTopMm,
        monthEndMm - recipientEndMm,
        headerHeightMm,
        "F",
      );
      doc.rect(recipientEndMm, headerTopMm, monthEndMm - recipientEndMm, headerHeightMm);
      doc.addImage(logoData, "PNG", 10, 8, 20, 12, undefined, "FAST");
      doc.setTextColor(35, 35, 35);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("A D I Y O G I", 84, 12.5, { align: "center" });
      doc.setFontSize(8);
      doc.text("C O N S T R U C T I O N", 84, 17, { align: "center" });
      doc.setFontSize(7);
      doc.text("TO:", brandEndMm + 1.5, 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        doc.splitTextToSize(companyName || "NA", recipientEndMm - brandEndMm - 3),
        brandEndMm + 1.5,
        17,
      );
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("ATTENDANCE MONTH:", recipientEndMm + 1.5, 10);
      doc.setFontSize(8);
      doc.text(
        `${formatMonth(month).toUpperCase()}${team ? ` ${team}` : ""}`,
        recipientEndMm + 1.5,
        17,
      );
    },
  });

  const renderedTableWidthMm = doc.lastAutoTable.getWidth(
    doc.internal.pageSize.getWidth(),
  );
  if (renderedTableWidthMm > printableWidthMm + 0.01) {
    throw new Error("Generated attendance table exceeds printable page width.");
  }

  return doc;
}

export async function generateAttendancePdf(options) {
  const doc = await createAttendancePdf(options);
  const pageWidthMm = doc.internal.pageSize.getWidth();
  const safeMonth = options.month.replace("-", "_");
  const safeTeam = (options.team || "all-teams")
    .trim()
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  doc.save(`attendance-${safeMonth}-${safeTeam || "all-teams"}.pdf`);
  return {
    pageCount: doc.internal.getNumberOfPages(),
    pageWidthMm,
    pageHeightMm: doc.internal.pageSize.getHeight(),
    tableWidthMm: doc.lastAutoTable.getWidth(doc.internal.pageSize.getWidth()),
    printableWidthMm: pageWidthMm - marginMm * 2,
  };
}
