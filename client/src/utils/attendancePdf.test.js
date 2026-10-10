import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  attendanceDaysInMonth,
  attendancePdfLayout,
  createAttendancePdf,
  validateAttendancePdfData,
} from "./attendancePdf.js";

const validWorker = {
  serialNumber: 1,
  workerName: "Labour Worker",
  attendance: Array(31).fill("P"),
  totalDH: "31 + 28",
  totalDays: "34.500",
};

test("attendance PDF table has fixed 31 day columns within A4 landscape width", () => {
  const layout = validateAttendancePdfData({
    month: "2026-10",
    workers: [validWorker],
  });

  assert.equal(layout.dayCount, 31);
  assert.equal(layout.columnWidthsMm.length, 37);
  assert.ok(Math.abs(layout.tableWidthMm - 286.74) < 0.000001);
  assert.ok(layout.tableWidthMm <= layout.printableWidthMm);
});

test("attendance PDF uses the selected month's exact number of days, including leap years", () => {
  const cases = [
    ["2026-09", 30],
    ["2026-10", 31],
    ["2026-02", 28],
    ["2024-02", 29],
  ];
  for (const [month, dayCount] of cases) {
    assert.equal(attendanceDaysInMonth(month), dayCount);
    const layout = validateAttendancePdfData({
      month,
      workers: [
        {
          ...validWorker,
          attendance: Array(dayCount).fill("P"),
        },
      ],
    });
    assert.equal(layout.dayCount, dayCount);
    assert.equal(layout.columnWidthsMm.length, dayCount + 6);
  }
  assert.throws(
    () =>
      validateAttendancePdfData({
        month: "2026-02",
        workers: [validWorker],
      }),
    /incomplete/,
  );
});

test("attendance PDF validation rejects invalid month, missing workers, and incomplete days", () => {
  assert.throws(
    () => validateAttendancePdfData({ month: "August 2026", workers: [validWorker] }),
    /valid attendance month/,
  );
  assert.throws(
    () => validateAttendancePdfData({ month: "2026-08", workers: [] }),
    /No workers match/,
  );
  assert.throws(
    () =>
      validateAttendancePdfData({
        month: "2026-08",
        workers: [{ ...validWorker, attendance: Array(30).fill("P") }],
      }),
    /incomplete/,
  );
});

test("fixed-width landscape table paginates vertically and retains selectable text", () => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const headers = [
    "SR.NO",
    "WORKERS NAME",
    "COMPANY",
    "LOCATION",
    ...Array.from({ length: 31 }, (_, index) => String(index + 1)),
    "TOTAL (D + H)",
    "TOTAL DAYS",
  ];
  const rows = Array.from({ length: 60 }, (_, index) => [
    String(index + 1),
    `Labour Worker ${index + 1}`,
    "Construction Company",
    "Site North",
    ...Array.from({ length: 31 }, (_, day) => (day === 0 ? "A" : "P+12")),
    "31 + 28",
    "34.500",
  ]);
  autoTable(doc, {
    head: [headers],
    body: rows,
    margin: { left: attendancePdfLayout.marginMm, right: attendancePdfLayout.marginMm },
    tableWidth: 286.74,
    rowPageBreak: "avoid",
    showHead: "everyPage",
    styles: { fontSize: 4.2, overflow: "ellipsize", minCellHeight: 4.7 },
    columnStyles: Object.fromEntries(
      [
        ...attendancePdfLayout.fixedColumnWidthsMm.slice(0, 4),
        ...Array(31).fill(attendancePdfLayout.dayColumnWidthMm),
        ...attendancePdfLayout.fixedColumnWidthsMm.slice(4),
      ].map((cellWidth, index) => [
        index,
        { cellWidth },
      ]),
    ),
  });

  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 297) < 0.01);
  assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 210) < 0.01);
  assert.ok(doc.internal.getNumberOfPages() > 1);
  assert.ok(
    doc.lastAutoTable.getWidth(doc.internal.pageSize.getWidth()) <= 287,
  );
  const pdfText = new TextDecoder("latin1").decode(
    new Uint8Array(doc.output("arraybuffer")),
  );
  assert.match(pdfText, /Labour Worker 1/);
});

test("PDF template renders validated attendance data with the fixed landscape layout", async () => {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  const logoBase64 = readFileSync(
    new URL("../assets/image.png", import.meta.url),
  ).toString("base64");
  globalThis.Image = class {
    set src(_value) {
      this.naturalWidth = 1;
      this.naturalHeight = 1;
      queueMicrotask(() => this.onload());
    }
  };
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({ drawImage() {} }),
      toDataURL: () => `data:image/png;base64,${logoBase64}`,
    }),
  };

  try {
    const workers = Array.from({ length: 60 }, (_, index) => ({
      serialNumber: index + 1,
      workerName: `Labour Worker ${index + 1}`,
      company: "Construction Company",
      location: "Site North",
      attendance: Array.from({ length: 31 }, (_, day) =>
        day === 0 ? "A" : day === 1 ? "P+P+12" : "P+12",
      ),
      totalDH: "31 + 28",
      totalDays: "34.500",
      totalDaysValue: 34.5,
    }));
    const doc = await createAttendancePdf({
      month: "2026-08",
      team: "TEAM 1",
      companyName: "Unified Post Tensioning System LLP",
      workers,
      fallbackLogoUrl: "/company-logo.png",
    });

    assert.ok(doc.internal.getNumberOfPages() > 1);
    assert.ok(
      doc.lastAutoTable.getWidth(doc.internal.pageSize.getWidth()) <= 287,
    );
    assert.ok(doc.output("arraybuffer").byteLength > 0);
    const pageHeaderText = doc.internal.pages[1].join("\n");
    assert.match(pageHeaderText, /Unified Post Tensioning System LLP/);
    assert.match(pageHeaderText, /A D I Y O G I/);
    assert.match(pageHeaderText, /ATTENDANCE MONTH:/);
    assert.match(pageHeaderText, /AUGUST 2026 TEAM 1/);
    assert.doesNotMatch(pageHeaderText, /GSTIN:|Contact:|Email:/);
    assert.equal(
      doc.lastAutoTable.body.some((row) => row.spansMultiplePages),
      false,
    );
    const firstRow = doc.lastAutoTable.body[0];
    assert.equal(firstRow.cells["1"].text.length, 1);
    assert.equal(firstRow.cells["5"].text.length, 1);
    assert.deepEqual(firstRow.cells["4"].styles.fillColor, [255, 194, 194]);
    assert.deepEqual(firstRow.cells["35"].styles.fillColor, [222, 240, 222]);
    assert.equal(
      new Set(doc.lastAutoTable.body.slice(0, 60).map((row) => row.height)).size,
      1,
    );
  } finally {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
  }
});

test("attendance PDF uses NA in the TO header without a company filter", async () => {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  const logoBase64 = readFileSync(
    new URL("../assets/image.png", import.meta.url),
  ).toString("base64");
  globalThis.Image = class {
    set src(_value) {
      this.naturalWidth = 1;
      this.naturalHeight = 1;
      queueMicrotask(() => this.onload());
    }
  };
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({ drawImage() {} }),
      toDataURL: () => `data:image/png;base64,${logoBase64}`,
    }),
  };

  try {
    const doc = await createAttendancePdf({
      month: "2026-10",
      team: "",
      workers: [validWorker],
      fallbackLogoUrl: "/company-logo.png",
    });
    const pageHeaderText = doc.internal.pages[1].join("\n");
    assert.match(pageHeaderText, /\(NA\)/);
    assert.match(pageHeaderText, /OCTOBER 2026/);
    assert.doesNotMatch(pageHeaderText, /ALL TEAMS/);
    assert.doesNotMatch(pageHeaderText, /Adiyogi Construction/);
  } finally {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
  }
});
