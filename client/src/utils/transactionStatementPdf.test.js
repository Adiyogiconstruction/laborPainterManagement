import assert from "node:assert/strict";
import test from "node:test";
import {
  createTransactionStatementPdf,
  summarizeTransactions,
} from "./transactionStatementPdf.js";

const profile = {
  companyName: "Adiyogi Constructions",
  address: "Thane, Maharashtra",
  mobile: "9000000000",
  email: "office@example.test",
  gstin: "GSTIN123",
};

const payments = [
  {
    flow: "OUTFLOW",
    kind: "WAGE",
    amount: 2800,
    paidOn: "2026-09-30T00:00:00.000Z",
    worker: { name: "Worker One" },
    notes: "Salary paid",
  },
  {
    flow: "INFLOW",
    kind: "REFUND",
    amount: 1200,
    paidOn: "2026-09-30T00:00:00.000Z",
    worker: { name: "Worker Two" },
  },
];

test("statement summary treats payments as debit and receipts as credit", () => {
  assert.deepEqual(summarizeTransactions(payments), {
    debit: 2800,
    credit: 1200,
    net: 1600,
    entries: 2,
  });
});

test("statement PDF supports empty statements and multiple transaction rows", () => {
  const doc = createTransactionStatementPdf({
    profile,
    from: "2026-09-01",
    to: "2026-09-30",
    payments,
  });
  assert.equal(doc.internal.getNumberOfPages(), 1);
  assert.ok(doc.output("arraybuffer").byteLength > 0);

  const emptyDoc = createTransactionStatementPdf({
    profile,
    from: "2026-09-01",
    to: "2026-09-30",
    payments: [],
  });
  assert.equal(emptyDoc.internal.getNumberOfPages(), 1);
});

test("statement PDF paginates the complete transaction list", () => {
  const doc = createTransactionStatementPdf({
    profile,
    from: "2026-09-01",
    to: "2026-09-30",
    payments: Array.from({ length: 100 }, (_, index) => ({
      ...payments[index % payments.length],
      _id: String(index),
      notes: `Transaction detail ${index + 1}`,
    })),
  });
  assert.ok(doc.internal.getNumberOfPages() > 1);
});

test("labour khata PDFs support account and master transaction layouts", () => {
  const accountDoc = createTransactionStatementPdf({
    profile,
    from: "2026-09-01",
    to: "2026-09-30",
    payments: payments.map((payment) => ({
      ...payment,
      balanceAfter: 1600,
    })),
    title: "LABOUR PAYMENT KHATA",
    subtitle: "Worker One · 9000000000 · North zone",
    includeWorker: false,
    includeBalance: true,
    balanceValue: 1600,
    balanceLabel: "CURRENT BALANCE",
  });
  const masterDoc = createTransactionStatementPdf({
    profile,
    from: "2026-09-01",
    to: "2026-09-30",
    payments: payments.map((payment) => ({
      ...payment,
      balanceAfter: 1600,
    })),
    title: "ALL LABOUR TRANSACTIONS",
    orientation: "landscape",
    includeWorker: true,
    includeBalance: true,
  });

  assert.ok(Math.abs(accountDoc.internal.pageSize.getWidth() - 210) < 0.01);
  assert.ok(Math.abs(masterDoc.internal.pageSize.getWidth() - 297) < 0.01);
  assert.ok(accountDoc.output("arraybuffer").byteLength > 0);
  assert.ok(masterDoc.output("arraybuffer").byteLength > 0);
});

test("statement PDF rejects missing company identity and invalid transactions", () => {
  assert.throws(
    () =>
      createTransactionStatementPdf({
        profile: {},
        from: "2026-09-01",
        to: "2026-09-30",
        payments,
      }),
    /Company profile name is required/,
  );
  assert.throws(
    () => summarizeTransactions([{ flow: "UNKNOWN", amount: 100 }]),
    /invalid flow/,
  );
});
