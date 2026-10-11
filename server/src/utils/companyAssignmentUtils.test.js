import assert from "node:assert/strict";
import test from "node:test";
import { getAssignmentDaysInRange } from "./companyAssignmentUtils.js";

const day = (value) => new Date(`${value}T00:00:00.000Z`);

test("ongoing assignments accrue through today, not future dates", () => {
  assert.equal(
    getAssignmentDaysInRange(
      { startDate: day("2026-10-10"), endDate: null },
      day("2026-10-01"),
      day("2026-10-31"),
      day("2026-10-11"),
    ),
    2,
  );
});

test("ongoing assignments respect a historical selected period", () => {
  assert.equal(
    getAssignmentDaysInRange(
      { startDate: day("2026-10-10"), endDate: null },
      day("2026-10-01"),
      day("2026-10-10"),
      day("2026-10-11"),
    ),
    1,
  );
});

test("completed assignments stop on their actual end date", () => {
  assert.equal(
    getAssignmentDaysInRange(
      { startDate: day("2026-10-10"), endDate: day("2026-10-12") },
      day("2026-10-01"),
      day("2026-10-31"),
      day("2026-10-11"),
    ),
    3,
  );
});
