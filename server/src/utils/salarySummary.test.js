import assert from "node:assert/strict";
import test from "node:test";
import { calculateSalaryAmountDue } from "./salarySummary.js";

test("previous due is not included until explicitly confirmed", () => {
  assert.equal(
    calculateSalaryAmountDue({
      currentMonthPayable: 1000,
      paidThisMonth: 200,
      previousDue: 500,
      carryForwardConfirmed: false,
    }),
    800,
  );
});

test("confirmed previous due is added to the selected month", () => {
  assert.equal(
    calculateSalaryAmountDue({
      currentMonthPayable: 1000,
      paidThisMonth: 200,
      previousDue: 500,
      carryForwardConfirmed: true,
    }),
    1300,
  );
});

test("confirmed previous credit reduces this month's due", () => {
  assert.equal(
    calculateSalaryAmountDue({
      currentMonthPayable: 1000,
      paidThisMonth: 200,
      previousDue: -500,
      carryForwardConfirmed: true,
    }),
    300,
  );
});
