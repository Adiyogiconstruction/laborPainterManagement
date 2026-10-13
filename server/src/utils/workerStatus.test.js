import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWorkerStatusFilter,
  getWorkerLabourStatus,
} from "./workerStatus.js";

test("legacy boolean statuses remain compatible", () => {
  assert.equal(getWorkerLabourStatus({ active: true }), "ACTIVE");
  assert.equal(getWorkerLabourStatus({ active: false }), "INACTIVE");
});

test("status filters separate inactive and Went Home workers", () => {
  const inactiveFilter = {};
  const wentHomeFilter = {};

  assert.equal(applyWorkerStatusFilter(inactiveFilter, "INACTIVE"), true);
  assert.deepEqual(inactiveFilter, {
    active: false,
    labourStatus: { $ne: "WENT_HOME" },
  });

  assert.equal(applyWorkerStatusFilter(wentHomeFilter, "WENT_HOME"), true);
  assert.deepEqual(wentHomeFilter, { labourStatus: "WENT_HOME" });
});
