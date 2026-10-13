import assert from "node:assert/strict";
import test from "node:test";
import {
  getCompanyWorkerRates,
  getWorkerRateHistory,
  upsertWorkerRateHistory,
  workerRateChangesAtDate,
} from "./companyWorkerRates.js";

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
      companyOvertimeRate: 0,
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
      companyOvertimeRate: 0,
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
      companyOvertimeRate: 0,
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
      companyOvertimeRate: 0,
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
            overtimeHourlyRate: 90,
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
      companyOvertimeRate: 90,
      dailyRate: 600,
      overtimeRate: 35,
    },
  );
});

test("zone labour overtime rate is used when no individual overtime rate is set", () => {
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
            labourOvertimeRate: 55,
          },
        ],
      ],
    ]),
  };
  assert.equal(
    getCompanyWorkerRates(
      {
        ...worker,
        defaultDailyRate: 0,
        overtimeHourlyRate: 0,
      },
      new Date("2026-10-10T00:00:00"),
      zoneHistory,
    ).overtimeRate,
    55,
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
      companyOvertimeRate: 0,
      dailyRate: 500,
      overtimeRate: 35,
    },
  );
});

test("worker rate history applies only on and after its effective date", () => {
  const rateWorker = {
    ...worker,
    defaultDailyRate: 0,
    overtimeHourlyRate: 0,
    rateHistory: [
      {
        applicableFrom: new Date("2026-10-10T00:00:00.000Z"),
        dailyRate: 500,
        overtimeRate: 25,
      },
    ],
  };
  const context = {
    companyByName: new Map(),
    ratesByWorker: new Map(),
    zoneRatesByCompanyZone: new Map(),
  };
  assert.equal(
    getCompanyWorkerRates(
      rateWorker,
      new Date("2026-10-09T00:00:00.000Z"),
      context,
    ).dailyRate,
    0,
  );
  assert.deepEqual(
    getCompanyWorkerRates(
      rateWorker,
      new Date("2026-10-10T00:00:00.000Z"),
      context,
    ),
    {
      companyDailyRate: 0,
      companyOvertimeRate: 0,
      dailyRate: 500,
      overtimeRate: 25,
    },
  );
});

test("explicit zero rates do not fall through to company zone rates", () => {
  const rateWorker = {
    ...worker,
    defaultDailyRate: 0,
    rateHistory: [
      {
        applicableFrom: new Date("2026-10-01T00:00:00.000Z"),
        dailyRate: 0,
        overtimeRate: 0,
      },
    ],
  };
  const context = {
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
  assert.equal(
    getCompanyWorkerRates(
      rateWorker,
      new Date("2026-10-10T00:00:00.000Z"),
      context,
    ).dailyRate,
    0,
  );
});

test("detects rate edits against the rate effective on the selected date", () => {
  const rateWorker = {
    ...worker,
    defaultDailyRate: 0,
    overtimeHourlyRate: 0,
    rateHistory: [
      {
        applicableFrom: new Date("2026-10-01T00:00:00.000Z"),
        dailyRate: 500,
        overtimeRate: 35,
      },
    ],
  };
  const context = {
    companyByName: new Map(),
    ratesByWorker: new Map(),
    zoneRatesByCompanyZone: new Map(),
  };
  assert.equal(
    workerRateChangesAtDate(
      rateWorker,
      new Date("2026-10-10T00:00:00.000Z"),
      0,
      35,
      context,
    ),
    true,
  );
  assert.equal(
    workerRateChangesAtDate(
      rateWorker,
      new Date("2026-10-10T00:00:00.000Z"),
      600,
      35,
      context,
    ),
    true,
  );
  assert.equal(
    workerRateChangesAtDate(
      rateWorker,
      new Date("2026-10-10T00:00:00.000Z"),
      500,
      35,
      context,
    ),
    false,
  );
});

test("worker rate changes replace same-day values and keep date history sorted", () => {
  const rateWorker = {
    rateHistory: [
      {
        applicableFrom: new Date("2026-10-20T00:00:00.000Z"),
        dailyRate: 700,
        overtimeRate: 70,
      },
    ],
  };
  upsertWorkerRateHistory(
    rateWorker,
    new Date("2026-10-10T10:00:00.000Z"),
    500,
    50,
  );
  upsertWorkerRateHistory(
    rateWorker,
    new Date("2026-10-10T00:00:00.000Z"),
    550,
    55,
  );
  assert.deepEqual(
    getWorkerRateHistory(rateWorker).map((rate) => [
      rate.applicableFrom.toISOString().slice(0, 10),
      rate.dailyRate,
      rate.overtimeRate,
    ]),
    [
      ["2026-10-10", 550, 55],
      ["2026-10-20", 700, 70],
    ],
  );
});
