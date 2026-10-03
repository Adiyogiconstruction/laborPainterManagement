import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const pageWidthMm = 297;
const pageHeightMm = 210;
const marginMm = 5;
const dayColumnWidthMm = 4.54;

export const attendancePdfLayout = Object.freeze({
  pageWidthMm,
  pageHeightMm,
  marginMm,
  columnWidthsMm: Object.freeze([
    7,
    38,
    24,
    23,
    ...Array(31).fill(dayColumnWidthMm),
    34,
    20,
  ]),
  dayColumnCount: 31,
});

export function validateAttendancePdfData({ month, workers }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")) {
    throw new Error("Select a valid attendance month before generating PDF.");
  }
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
      worker.attendance.length !== attendancePdfLayout.dayColumnCount ||
      !worker.attendance.every((code) => typeof code === "string") ||
      !["string", "number"].includes(typeof worker.totalDH) ||
      !["string", "number"].includes(typeof worker.totalDays)
    ) {
      throw new Error(`Attendance data is incomplete for row ${index + 1}.`);
    }
  });

  const tableWidthMm = attendancePdfLayout.columnWidthsMm.reduce(
    (total, width) => total + width,
    0,
  );
  const printableWidthMm = pageWidthMm - marginMm * 2;
  if (tableWidthMm > printableWidthMm) {
    throw new Error("Attendance PDF columns exceed the printable page width.");
  }
  return { tableWidthMm, printableWidthMm };
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
  const { tableWidthMm, printableWidthMm } = validateAttendancePdfData({
    month,
    workers,
  });
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
    ...Array.from({ length: attendancePdfLayout.dayColumnCount }, (_, index) =>
      String(index + 1),
    ),
    "TOTAL (D + H)",
    "TOTAL DAYS",
  ];
  if (headers.length !== attendancePdfLayout.columnWidthsMm.length) {
    throw new Error("Attendance PDF must contain 31 day columns and both totals.");
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

  const widths = attendancePdfLayout.columnWidthsMm;
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 36,
    margin: {
      top: 36,
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
        column.index <= 34 &&
        typeof cell.raw === "string" &&
        cell.raw
      ) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(4.2);
        const availableWidth = widths[column.index] - 0.5;
        const textWidth = doc.getTextWidth(cell.raw);
        if (textWidth > availableWidth) {
          cell.styles.fontSize = Math.max(
            column.index >= 4 ? 2.8 : 3.4,
            4.2 * (availableWidth / textWidth),
          );
        }
      }
      if (section === "body" && column.index >= 4 && column.index <= 34) {
        if (cell.raw === "A") {
          cell.styles.fillColor = [255, 194, 194];
        } else {
          cell.styles.fillColor = [255, 255, 255];
        }
      }
      if (section === "body" && column.index >= 35) {
        cell.styles.fillColor = [222, 240, 222];
        cell.styles.fontStyle = "bold";
      }
    },
    willDrawPage() {
      const page = doc.internal.pageSize;
      doc.addImage(logoData, "PNG", marginMm, 7, 24, 21, undefined, "FAST");
      doc.setTextColor(35, 35, 35);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("TO:", 34, 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(companyName || "Company", 108), 45, 11);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("ATTENDANCE MONTH:", 166, 11);
      doc.setFontSize(10);
      doc.text(
        `${formatMonth(month).toUpperCase()} ${team || "ALL TEAMS"}`.trim(),
        166,
        17,
      );
      doc.setDrawColor(115, 115, 115);
      doc.setLineWidth(0.2);
      doc.line(marginMm, 31, page.getWidth() - marginMm, 31);
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
