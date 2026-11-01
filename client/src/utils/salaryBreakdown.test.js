import assert from "node:assert/strict";
import test from "node:test";
import { createSalaryBreakdown } from "./salaryBreakdown.js";

test("salary breakdown keeps overtime as hours and separates its payable", () => {
  const breakdown = createSalaryBreakdown({
    month: "2026-11",
    workUnits: 41,
    dailyPayable: 27333,
    overtimeHours: 2,
    overtimePayable: 167,
    totalPayable: 27500,
    previousDue: 1200,
    paidThisMonth: 5000,
    amountDue: 23700,
  });

  assert.equal(
    breakdown.formula,
    "41 days × ₹666.66 + (2 OT hrs × ₹83.5)",
  );
  assert.equal(breakdown.calculation, "₹27,333 + ₹167 = ₹27,500");
  assert.equal(breakdown.total, 27500);
  assert.equal(breakdown.previousDue, 1200);
  assert.equal(breakdown.amountDue, 23700);
  assert.equal(breakdown.monthLabel, "November 2026");
});

test("salary breakdown uses weighted actual rates for fractional work units", () => {
  const breakdown = createSalaryBreakdown({
    workUnits: 2.5,
    dailyPayable: 1750,
    overtimeHours: 1.5,
    overtimePayable: 150,
    totalPayable: 1900,
    previousDue: 0,
    paidThisMonth: 0,
    amountDue: 1900,
    month: "2026-11",
  });

  assert.equal(
    breakdown.formula,
    "2.5 days × ₹700 + (1.5 OT hrs × ₹100)",
  );
});

test("salary breakdown is unavailable until complete attendance totals load", () => {
  assert.equal(createSalaryBreakdown(null), null);
  assert.equal(createSalaryBreakdown({ totalPayable: 100 }), null);
  assert.equal(
    createSalaryBreakdown({
      workUnits: 0,
      dailyPayable: 0,
      overtimeHours: 0,
      overtimePayable: 0,
      totalPayable: 0,
      previousDue: 0,
      paidThisMonth: 0,
      amountDue: 0,
    }),
    null,
  );
});

test("salary breakdown still includes carried dues when there is no current-month attendance", () => {
  const breakdown = createSalaryBreakdown({
    month: "2026-11",
    workUnits: 0,
    dailyPayable: 0,
    overtimeHours: 0,
    overtimePayable: 0,
    totalPayable: 0,
    previousDue: 900,
    paidThisMonth: 100,
    amountDue: 800,
  });

  assert.equal(breakdown.formula, "No attendance payable this month");
  assert.equal(breakdown.amountDue, 800);
});
