import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAttendanceBalance,
  sumNetPaymentsForWorkers,
} from "./attendancePaymentSummary.js";

test("sums payments only for selected workers and subtracts refunds", () => {
  const payments = [
    { worker: { _id: "worker-1" }, flow: "OUTFLOW", amount: 20_000 },
    { worker: "worker-1", flow: "OUTFLOW", amount: 10_000 },
    { worker: { _id: "worker-1" }, flow: "INFLOW", amount: 5_000 },
    { worker: "worker-2", flow: "OUTFLOW", amount: 90_000 },
    { worker: null, flow: "OUTFLOW", amount: 1_000 },
  ];

  assert.equal(sumNetPaymentsForWorkers(payments, ["worker-1"]), 25_000);
});

test("ignores invalid amounts and returns zero when no selected worker was paid", () => {
  assert.equal(
    sumNetPaymentsForWorkers(
      [
        { worker: "worker-1", flow: "OUTFLOW", amount: "invalid" },
        { worker: "worker-1", flow: "OTHER", amount: 500 },
      ],
      ["worker-1"],
    ),
    0,
  );
});

test("calculates balance as total payable minus already paid", () => {
  assert.equal(calculateAttendanceBalance(74_476, 30_000), 44_476);
  assert.equal(calculateAttendanceBalance(20_000, 25_000), -5_000);
});
