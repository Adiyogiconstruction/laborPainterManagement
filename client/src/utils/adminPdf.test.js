import assert from "node:assert/strict";
import test from "node:test";
import { createAdminActivityPdf } from "./adminActivityPdf.js";
import { createAdminUsagePdf } from "./adminUsagePdf.js";

const serialNumbers = (table) =>
  table.body.map((row) => row.cells["0"].text.join(""));
const headers = (table) =>
  Object.values(table.head[0].cells).map((cell) => cell.text.join(""));

test("admin activity PDF numbers entries from 1 in the first column", () => {
  const activities = Array.from({ length: 10 }, (_, index) => ({
    createdAt: `2026-10-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
    action: "UPDATE",
    message: `Activity ${index + 1}`,
  }));
  const doc = createAdminActivityPdf({
    user: { name: "Admin", email: "admin@example.test", role: "ADMIN" },
    activities,
  });

  assert.deepEqual(
    headers(doc.lastAutoTable),
    ["Sr. No.", "Date & time", "Action", "Details"],
  );
  assert.deepEqual(serialNumbers(doc.lastAutoTable), [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
  ]);
});

test("admin usage PDF numbers entries and leaves its total row unnumbered", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    date: `2026-10-${String(index + 1).padStart(2, "0")}`,
    userName: `Admin ${index + 1}`,
    activeMilliseconds: 60_000,
    inactiveMilliseconds: 120_000,
  }));
  const doc = createAdminUsagePdf({
    profile: null,
    filters: { from: "2026-10-01", to: "2026-10-10" },
    rows,
  });

  assert.deepEqual(
    headers(doc.lastAutoTable),
    ["Sr. No.", "Date", "User name", "Active Time", "Non-active Time"],
  );
  assert.deepEqual(serialNumbers(doc.lastAutoTable), [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "",
  ]);
  assert.equal(
    doc.lastAutoTable.body.at(-1).cells["3"].text.join(""),
    "00h 10m",
  );
  assert.equal(
    doc.lastAutoTable.body.at(-1).cells["4"].text.join(""),
    "00h 20m",
  );
});

test("admin PDFs show a placeholder rather than numbering an empty report", () => {
  const activityPdf = createAdminActivityPdf({
    user: { name: "Admin", email: "admin@example.test", role: "ADMIN" },
    activities: [],
  });
  const usagePdf = createAdminUsagePdf({
    profile: null,
    filters: { from: "2026-10-01", to: "2026-10-10" },
    rows: [],
  });

  assert.deepEqual(serialNumbers(activityPdf.lastAutoTable), ["—"]);
  assert.deepEqual(serialNumbers(usagePdf.lastAutoTable), ["—"]);
});
