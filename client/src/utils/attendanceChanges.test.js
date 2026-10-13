import assert from "node:assert/strict";
import test from "node:test";
import { buildDirtyAttendanceEntries } from "./attendanceChanges.js";

const workers = [{ _id: "ajit" }, { _id: "akhilesh" }, { _id: "ashish" }];
const common = {
  workers,
  days: 1,
  month: "2026-10",
  originalCells: {},
};

test("only changed attendance cells are sent, preserving other users' saves", () => {
  const entries = buildDirtyAttendanceEntries({
    ...common,
    cells: {
      "ajit:2026-10-01": { status: "PRESENT", overtimeHours: 0 },
      "akhilesh:2026-10-01": { status: "ABSENT", overtimeHours: 0 },
      "ashish:2026-10-01": { status: "NOT_MARKED", overtimeHours: 0 },
    },
  });

  assert.deepEqual(entries, [
    {
      worker: "ajit",
      date: "2026-10-01",
      status: "PRESENT",
      overtimeHours: 0,
    },
    {
      worker: "akhilesh",
      date: "2026-10-01",
      status: "ABSENT",
      overtimeHours: 0,
    },
  ]);
});

test("explicitly clearing an existing cell sends a delete marker", () => {
  const entries = buildDirtyAttendanceEntries({
    ...common,
    cells: {},
    originalCells: {
      "ajit:2026-10-01": { status: "PRESENT", overtimeHours: 2 },
    },
  });

  assert.deepEqual(entries, [
    {
      worker: "ajit",
      date: "2026-10-01",
      status: "NOT_MARKED",
      overtimeHours: 0,
      clear: true,
    },
  ]);
});

test("unchanged marked attendance and unmarked cells are omitted", () => {
  const attendance = { status: "PRESENT", overtimeHours: 1.5 };
  assert.deepEqual(
    buildDirtyAttendanceEntries({
      ...common,
      cells: { "ajit:2026-10-01": attendance },
      originalCells: { "ajit:2026-10-01": attendance },
    }),
    [],
  );
});
