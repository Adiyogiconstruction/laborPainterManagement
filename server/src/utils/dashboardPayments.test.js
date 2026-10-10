import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDashboardPayments } from "./dashboardPayments.js";

test("dashboard payment summary separates expenses, advances, other outflows, and net paid", () => {
  const summary = summarizeDashboardPayments(
    [
      { worker: "worker-1", flow: "OUTFLOW", kind: "WAGE", amount: 800 },
      { worker: "worker-1", flow: "OUTFLOW", kind: "ADVANCE", amount: 200 },
      { worker: "worker-1", flow: "OUTFLOW", kind: "TRAVEL_ADVANCE", amount: 50 },
      { worker: "worker-1", flow: "INFLOW", kind: "REFUND", amount: 25 },
      { worker: "worker-1", flow: "OUTFLOW", kind: "OTHER", amount: 30, notes: "Food" },
      { flow: "OUTFLOW", kind: "EXPENSE", amount: 100, notes: "Kharchi" },
    ],
    new Set(["worker-1"]),
  );

  assert.equal(summary.paid, 1055);
  assert.equal(summary.advancePaid, 250);
  assert.equal(summary.expenseTotal, 100);
  assert.equal(summary.otherOutflowTotal, 30);
  assert.deepEqual(summary.expenseBreakdown, [
    { label: "Advance", amount: 250 },
    { label: "Kharchi", amount: 100 },
    { label: "Food", amount: 30 },
  ]);
  assert.equal(summary.paymentKinds.REFUND, -25);
});

test("dashboard payment summary excludes unselected worker payments from worker totals", () => {
  const summary = summarizeDashboardPayments(
    [
      { worker: "worker-2", flow: "OUTFLOW", kind: "ADVANCE", amount: 300 },
      { flow: "OUTFLOW", kind: "EXPENSE", amount: 120 },
    ],
    new Set(["worker-1"]),
  );

  assert.equal(summary.paid, 0);
  assert.equal(summary.advancePaid, 0);
  assert.equal(summary.expenseTotal, 120);
});
