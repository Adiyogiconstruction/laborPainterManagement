import assert from "node:assert/strict";
import test from "node:test";
import { getCompanyWorkerRates } from "./companyWorkerRates.js";

const worker = {
  _id: "worker-1",
  companyName: "Example Co",
  workZone: "Mumbai",
  defaultDailyRate: 500,
  overtimeHourlyRate: 35,
};

const company = {
  _id: "company-1",
  companyLabourRate: 700,
};

const rateDate = new Date("2026-10-10T00:00:00.000Z");
const history = {
  companyByName: new Map([["Example Co", company]]),
  ratesByWorker: new Map([
    [
      "worker-1",
      [
        {
          applicableFrom: rateDate,
          companyDailyRate: 800,
          labourDailyRate: 550,
          labourOvertimeRate: 45,
        },
      ],
    ],
  ]),
};

test("company worker rates use configured history from its effective date", () => {
  assert.deepEqual(
    getCompanyWorkerRates(worker, new Date("2026-10-10T00:00:00"), history),
    {
      companyDailyRate: 800,
      dailyRate: 550,
      overtimeRate: 45,
    },
  );
});

test("company worker rates leave earlier attendance at legacy defaults", () => {
  assert.deepEqual(
    getCompanyWorkerRates(worker, new Date("2026-10-09T00:00:00"), history),
    {
      companyDailyRate: 700,
      dailyRate: 500,
      overtimeRate: 35,
    },
  );
});

test("company zone rate overrides worker company rate from its effective date", () => {
  const zoneHistory = {
    ...history,
    zoneRatesByCompanyZone: new Map([
      [
        "company-1:mumbai",
        [
          {
            applicableFrom: rateDate,
            dailyRate: 1250,
          },
        ],
      ],
    ]),
  };
  assert.deepEqual(
    getCompanyWorkerRates(
      worker,
      new Date("2026-10-10T00:00:00"),
      zoneHistory,
    ),
    {
      companyDailyRate: 1250,
      dailyRate: 550,
      overtimeRate: 45,
    },
  );
});

test("company zone rate does not change billing before its effective date", () => {
  const zoneHistory = {
    ...history,
    zoneRatesByCompanyZone: new Map([
      [
        "company-1:mumbai",
        [
          {
            applicableFrom: rateDate,
            dailyRate: 1250,
          },
        ],
      ],
    ]),
  };
  assert.deepEqual(
    getCompanyWorkerRates(
      worker,
      new Date("2026-10-09T00:00:00"),
      zoneHistory,
    ),
    {
      companyDailyRate: 700,
      dailyRate: 500,
      overtimeRate: 35,
    },
  );
});

test("company zone rate is specific to the worker's assigned zone", () => {
  const zoneHistory = {
    ...history,
    zoneRatesByCompanyZone: new Map([
      [
        "company-1:mumbai",
        [
          {
            applicableFrom: new Date("2026-10-01T00:00:00.000Z"),
            dailyRate: 1250,
          },
        ],
      ],
    ]),
  };
  assert.equal(
    getCompanyWorkerRates(
      { ...worker, workZone: "Chennai" },
      new Date("2026-10-10T00:00:00"),
      zoneHistory,
    ).companyDailyRate,
    800,
  );
});

test("zone labour rate is the default when no individual labour rate is set", () => {
  const zoneHistory = {
    companyByName: history.companyByName,
    ratesByWorker: new Map(),
    zoneRatesByCompanyZone: new Map([
      [
        "company-1:mumbai",
        [
          {
            applicableFrom: new Date("2026-10-01T00:00:00.000Z"),
            dailyRate: 1250,
            labourDailyRate: 600,
          },
        ],
      ],
    ]),
  };
  assert.deepEqual(
    getCompanyWorkerRates(
      { ...worker, defaultDailyRate: 0 },
      new Date("2026-10-10T00:00:00"),
      zoneHistory,
    ),
    {
      companyDailyRate: 1250,
      dailyRate: 600,
      overtimeRate: 35,
    },
  );
});

test("company worker rates fall back to worker defaults without a company", () => {
  assert.deepEqual(
    getCompanyWorkerRates(
      { ...worker, companyName: "Unassigned Co" },
      new Date("2026-10-09T00:00:00"),
      history,
    ),
    {
      companyDailyRate: 0,
      dailyRate: 500,
      overtimeRate: 35,
    },
  );
});
