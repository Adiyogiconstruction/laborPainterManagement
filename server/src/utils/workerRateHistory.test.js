import assert from "node:assert/strict";
import test from "node:test";
import {
  getAttendanceRateDate,
  isAttendanceOnOrAfterRateDate,
} from "./workerRateHistory.js";

test("effective rate date includes attendance on that calendar date", () => {
  const applicableFrom = new Date("2026-10-15T00:00:00.000Z");
  assert.equal(
    isAttendanceOnOrAfterRateDate(
      new Date("2026-10-14T18:30:00.000Z"),
      applicableFrom,
    ),
    true,
  );
});

test("effective rate date does not change attendance from the previous day", () => {
  const applicableFrom = new Date("2026-10-15T00:00:00.000Z");
  assert.equal(
    isAttendanceOnOrAfterRateDate(
      new Date("2026-10-13T18:30:00.000Z"),
      applicableFrom,
    ),
    false,
  );
});

test("effective rate date includes later attendance", () => {
  const applicableFrom = new Date("2026-10-15T00:00:00.000Z");
  assert.equal(
    isAttendanceOnOrAfterRateDate(
      new Date("2026-10-15T18:30:00.000Z"),
      applicableFrom,
    ),
    true,
  );
});

test("effective rate date works with UTC-midnight attendance records", () => {
  const applicableFrom = new Date("2026-10-15T00:00:00.000Z");
  assert.equal(
    isAttendanceOnOrAfterRateDate(
      new Date("2026-10-15T00:00:00.000Z"),
      applicableFrom,
    ),
    true,
  );
});

test("recalculation resolves India-midnight attendance to its intended rate date", () => {
  assert.equal(
    getAttendanceRateDate(new Date("2026-10-14T18:30:00.000Z")).toISOString(),
    "2026-10-15T00:00:00.000Z",
  );
});
