import assert from "node:assert/strict";
import test from "node:test";
import {
  balanceType,
  buildPaymentReminder,
  filterAndSortWorkers,
  parseCsv,
  paymentBalances,
} from "./paymentLedger.js";

const workers = [
  {
    _id: "due-2",
    name: "Bina",
    active: true,
    phone: "98765",
    companyName: "BuildCo",
    teamName: "Alpha",
    workZone: "North",
    totalDue: 200,
    overpaid: 0,
    lastPaymentOn: "2026-10-01",
  },
  {
    _id: "due-1",
    name: "Aman",
    active: false,
    phone: "91234",
    companyName: "BuildCo",
    teamName: "Beta",
    workZone: "South",
    totalDue: 600,
    overpaid: 0,
    lastPaymentOn: "2026-09-01",
  },
  {
    _id: "over",
    name: "Chirag",
    active: true,
    phone: "90000",
    companyName: "OtherCo",
    teamName: "Alpha",
    workZone: "North",
    totalDue: 0,
    overpaid: 150,
    lastPaymentOn: "2026-10-03",
  },
];

test("payment ledger filters, balance categories, and sort order are consistent", () => {
  assert.equal(balanceType(workers[0]), "DENA_HAI");
  assert.equal(balanceType(workers[2]), "LENA_HAI");
  assert.deepEqual(
    filterAndSortWorkers(workers, { balance: "DUE", sort: "BALANCE_HIGH" }).map(
      (worker) => worker._id,
    ),
    ["due-1", "due-2"],
  );
  assert.deepEqual(
    filterAndSortWorkers(workers, { sort: "BALANCE_LOW" }).map(
      (worker) => worker._id,
    ),
    ["over", "due-2", "due-1"],
  );
  assert.deepEqual(
    filterAndSortWorkers(workers, {
      search: "912",
      company: "BuildCo",
      sort: "NAME",
    }).map((worker) => worker._id),
    ["due-1"],
  );
  assert.deepEqual(
    filterAndSortWorkers(workers, { balance: "OVERPAID" }).map(
      (worker) => worker._id,
    ),
    ["over"],
  );
  assert.deepEqual(
    filterAndSortWorkers(workers, {
      company: "BuildCo",
      team: "Alpha",
      zone: "North",
    }).map((worker) => worker._id),
    ["due-2"],
  );
  assert.deepEqual(
    filterAndSortWorkers(workers, { status: "ACTIVE" }).map(
      (worker) => worker._id,
    ),
    ["over", "due-2"],
  );
  assert.deepEqual(
    filterAndSortWorkers(workers, { status: "INACTIVE" }).map(
      (worker) => worker._id,
    ),
    ["due-1"],
  );
});

test("running balances reverse receipts and payouts from positive or negative balance", () => {
  const rows = paymentBalances(
    [
      { _id: "out", flow: "OUTFLOW", amount: 300, paidOn: "2026-10-02" },
      { _id: "in", flow: "INFLOW", amount: 50, paidOn: "2026-10-03" },
    ],
    750,
  );
  assert.deepEqual(
    rows.map(({ _id, balanceAfter }) => [_id, balanceAfter]),
    [
      ["in", 750],
      ["out", 700],
    ],
  );
  const overpaidRows = paymentBalances(
    [
      { _id: "out", flow: "OUTFLOW", amount: 300, paidOn: "2026-10-02" },
      { _id: "in", flow: "INFLOW", amount: 50, paidOn: "2026-10-03" },
    ],
    -150,
  );
  assert.deepEqual(
    overpaidRows.map(({ _id, balanceAfter }) => [_id, balanceAfter]),
    [
      ["in", -150],
      ["out", -200],
    ],
  );
});

test("CSV parser handles escaped quotes, commas, CRLF, and rejects unclosed fields", () => {
  assert.deepEqual(parseCsv('Name,Notes\r\n"A, B","He said ""yes"""'), [
    ["Name", "Notes"],
    ["A, B", 'He said "yes"'],
  ]);
  assert.throws(() => parseCsv('Name\n"unfinished'), /unclosed quoted value/);
});

test("payment reminder states the balance without sending anything", () => {
  assert.match(
    buildPaymentReminder({ name: "Aman", totalDue: 1200 }),
    /payable of ₹1,200/,
  );
});
