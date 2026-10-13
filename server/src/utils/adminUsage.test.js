import test from "node:test";
import assert from "node:assert/strict";
import {
  currentUsageDate,
  getUsagePeriodRange,
  summarizeAdminUsage,
} from "./adminUsage.js";

test("returns India-local day, Monday-based week, month and year boundaries", () => {
  assert.deepEqual(getUsagePeriodRange("day", "2026-10-09"), {
    start: new Date("2026-10-08T18:30:00.000Z"),
    end: new Date("2026-10-09T18:30:00.000Z"),
  });
  assert.deepEqual(getUsagePeriodRange("week", "2026-10-09"), {
    start: new Date("2026-10-04T18:30:00.000Z"),
    end: new Date("2026-10-11T18:30:00.000Z"),
  });
  assert.deepEqual(getUsagePeriodRange("month", "2026-10-09"), {
    start: new Date("2026-09-30T18:30:00.000Z"),
    end: new Date("2026-10-31T18:30:00.000Z"),
  });
  assert.deepEqual(getUsagePeriodRange("year", "2026-10-09"), {
    start: new Date("2025-12-31T18:30:00.000Z"),
    end: new Date("2026-12-31T18:30:00.000Z"),
  });
});

test("defaults usage reports to the current India-local date", () => {
  assert.equal(currentUsageDate("2026-10-08T20:00:00.000Z"), "2026-10-09");
});

test("rejects invalid dates and unsupported period values", () => {
  assert.throws(() => getUsagePeriodRange("decade", "2026-10-09"));
  assert.throws(() => getUsagePeriodRange("day", "2026-02-30"));
});

test("sums only session time overlapping the selected period", () => {
  const result = summarizeAdminUsage(
    [
      {
        startedAt: "2026-10-08T18:00:00.000Z",
        endedAt: "2026-10-08T19:00:00.000Z",
        expiresAt: "2026-10-09T02:00:00.000Z",
      },
      {
        startedAt: "2026-10-08T20:30:00.000Z",
        lastSeenAt: "2026-10-08T21:29:00.000Z",
        endedAt: null,
        expiresAt: "2026-10-09T04:30:00.000Z",
      },
    ],
    "2026-10-08T18:30:00.000Z",
    "2026-10-09T18:30:00.000Z",
    "2026-10-08T21:30:00.000Z",
  );

  assert.deepEqual(result, {
    totalMilliseconds: 90 * 60 * 1000,
    sessionCount: 2,
    activeSessionCount: 1,
  });
});

test("stops sessions without a recent heartbeat at their last activity check", () => {
  const result = summarizeAdminUsage(
    [
      {
        startedAt: "2026-10-09T00:00:00.000Z",
        lastSeenAt: "2026-10-09T07:50:00.000Z",
        endedAt: null,
        expiresAt: "2026-10-09T08:00:00.000Z",
      },
    ],
    "2026-10-09T00:00:00.000Z",
    "2026-10-10T00:00:00.000Z",
    "2026-10-09T12:00:00.000Z",
  );

  assert.deepEqual(result, {
    totalMilliseconds: 7 * 60 * 60 * 1000 + 50 * 60 * 1000,
    sessionCount: 1,
    activeSessionCount: 0,
  });
});

test("counts a recent heartbeat as active through the current time", () => {
  const result = summarizeAdminUsage(
    [
      {
        startedAt: "2026-10-09T00:00:00.000Z",
        lastSeenAt: "2026-10-09T07:55:00.000Z",
        endedAt: null,
        expiresAt: "2026-10-09T08:30:00.000Z",
      },
    ],
    "2026-10-09T00:00:00.000Z",
    "2026-10-10T00:00:00.000Z",
    "2026-10-09T08:00:00.000Z",
  );

  assert.deepEqual(result, {
    totalMilliseconds: 8 * 60 * 60 * 1000,
    sessionCount: 1,
    activeSessionCount: 1,
  });
});
