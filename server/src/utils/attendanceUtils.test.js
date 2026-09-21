import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAttendanceMap,
  calculatePayableAmount,
  getWorkUnits,
  normalizeAttendanceStatus,
} from "./attendanceUtils.js";

test("normalizeAttendanceStatus supports the new default unmarked flow", () => {
  assert.equal(normalizeAttendanceStatus("not marked"), "NOT_MARKED");
  assert.equal(normalizeAttendanceStatus("present"), "PRESENT");
  assert.equal(normalizeAttendanceStatus("half day"), "HALF_DAY");
  assert.equal(normalizeAttendanceStatus("leave"), "LEAVE");
});

test("work units follow the business rule", () => {
  assert.equal(getWorkUnits("PRESENT"), 1);
  assert.equal(getWorkUnits("HALF_DAY"), 0.5);
  assert.equal(getWorkUnits("ABSENT"), 0);
  assert.equal(getWorkUnits("NOT_MARKED"), 0);
});

test("payable amount includes the rate snapshot and overtime", () => {
  assert.equal(
    calculatePayableAmount({
      dailyRate: 500,
      overtimeHours: 2,
      overtimeRate: 100,
      status: "PRESENT",
    }),
    700,
  );
  assert.equal(
    calculatePayableAmount({
      dailyRate: 500,
      overtimeHours: 0,
      overtimeRate: 100,
      status: "HALF_DAY",
    }),
    250,
  );
  assert.equal(
    calculatePayableAmount({
      dailyRate: 500,
      overtimeHours: 4,
      overtimeRate: 120,
      status: "ABSENT",
    }),
    480,
  );
});

test("double-present and overtime are calculated separately", () => {
  assert.equal(getWorkUnits("2P"), 2);
  assert.equal(
    calculatePayableAmount({
      dailyRate: 500,
      overtimeHours: 2,
      overtimeRate: 100,
      status: "DOUBLE_PRESENT",
    }),
    1200,
  );
});

test("buildAttendanceMap groups records by worker and date", () => {
  const records = [
    { worker: "w1", date: "2026-09-17", status: "PRESENT" },
    { worker: "w1", date: "2026-09-18", status: "ABSENT" },
    { worker: "w2", date: "2026-09-17", status: "NOT_MARKED" },
  ];

  assert.deepEqual(buildAttendanceMap(records), {
    w1: {
      "2026-09-17": "PRESENT",
      "2026-09-18": "ABSENT",
    },
    w2: {
      "2026-09-17": "NOT_MARKED",
    },
  });
});
