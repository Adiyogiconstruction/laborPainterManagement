import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAttendanceProfit,
  getAssignmentDaysInRange,
  summarizeAssignmentAttendance,
} from "./companyAssignmentUtils.js";

const day = (value) => new Date(`${value}T00:00:00.000Z`);

test("labour profit is the rate difference multiplied by attended work units", () => {
  assert.deepEqual(
    calculateAttendanceProfit({
      companyDailyRate: 1000,
      labourDailyRate: 600,
      workUnits: 1,
    }),
    {
      companyBilling: 1000,
      labourSalary: 600,
      dutyProfit: 400,
      overtimeProfit: 0,
    },
  );
  assert.equal(
    calculateAttendanceProfit({
      companyDailyRate: 1000,
      labourDailyRate: 600,
      workUnits: 3,
    }).dutyProfit,
    1200,
  );
});

test("ongoing assignments accrue through today, not future dates", () => {
  assert.equal(
    getAssignmentDaysInRange(
      { startDate: day("2026-10-10"), endDate: null },
      day("2026-10-01"),
      day("2026-10-31"),
      day("2026-10-11"),
    ),
    2,
  );
});

test("ongoing assignments respect a historical selected period", () => {
  assert.equal(
    getAssignmentDaysInRange(
      { startDate: day("2026-10-10"), endDate: null },
      day("2026-10-01"),
      day("2026-10-10"),
      day("2026-10-11"),
    ),
    1,
  );
});

test("completed assignments stop on their actual end date", () => {
  assert.equal(
    getAssignmentDaysInRange(
      { startDate: day("2026-10-10"), endDate: day("2026-10-12") },
      day("2026-10-01"),
      day("2026-10-31"),
      day("2026-10-11"),
    ),
    3,
  );
});

test("assignment profit uses only selected labour attendance and actual payable", () => {
  const summary = summarizeAssignmentAttendance(
    {
      workerIds: ["worker-a"],
      startDate: day("2026-10-10"),
      endDate: null,
      companyLabourRate: 1000,
      companyOvertimeRate: 100,
    },
    [
      {
        worker: "worker-a",
        date: day("2026-10-10"),
        workUnits: 1,
        overtimeHours: 2,
        payableAmount: 700,
      },
      {
        worker: "worker-a",
        date: day("2026-10-11"),
        workUnits: 0,
        overtimeHours: 0,
        payableAmount: 0,
      },
      {
        worker: "worker-b",
        date: day("2026-10-10"),
        workUnits: 1,
        payableAmount: 500,
      },
    ],
    day("2026-10-01"),
    day("2026-10-31"),
    day("2026-10-11"),
  );

  assert.deepEqual(summary, { labourDays: 1, profit: 500 });
});

test("unmarked days and dates outside the assignment do not accrue profit", () => {
  const summary = summarizeAssignmentAttendance(
    {
      workerIds: ["worker-a"],
      startDate: day("2026-10-10"),
      endDate: day("2026-10-10"),
      companyLabourRate: 1000,
    },
    [
      {
        worker: "worker-a",
        date: day("2026-10-09"),
        workUnits: 1,
        payableAmount: 400,
      },
      {
        worker: "worker-a",
        date: day("2026-10-11"),
        workUnits: 1,
        payableAmount: 400,
      },
    ],
    day("2026-10-01"),
    day("2026-10-31"),
    day("2026-10-31"),
  );

  assert.deepEqual(summary, { labourDays: 0, profit: 0 });
});

test("legacy headcount assignments are identified for their existing calculation", () => {
  assert.equal(
    summarizeAssignmentAttendance(
      { workerIds: [], startDate: day("2026-10-10"), endDate: null },
      [],
      day("2026-10-01"),
      day("2026-10-31"),
      day("2026-10-11"),
    ),
    null,
  );
});
