import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_USAGE_IDLE_THRESHOLD_MS,
  isAdminUsageActive,
} from "./adminUsageTracking.js";

test("marks activity as active through the five-minute idle threshold", () => {
  const now = 1_800_000_000_000;

  assert.equal(isAdminUsageActive(now - 299_999, now), true);
  assert.equal(
    isAdminUsageActive(now - ADMIN_USAGE_IDLE_THRESHOLD_MS, now),
    true,
  );
  assert.equal(isAdminUsageActive(now - 300_001, now), false);
});

test("rejects invalid or future activity timestamps", () => {
  const now = 1_800_000_000_000;

  assert.equal(isAdminUsageActive(Number.NaN, now), false);
  assert.equal(isAdminUsageActive(now + 1, now), false);
});
