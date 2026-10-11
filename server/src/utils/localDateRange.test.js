import assert from "node:assert/strict";
import test from "node:test";
import { parseLocalDateOnly } from "./localDateRange.js";

test("local date boundaries include attendance saved for every month", () => {
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const month = String(monthIndex + 1).padStart(2, "0");
    const lastDay = new Date(2026, monthIndex + 1, 0).getDate();
    const attendanceDate = new Date(2026, monthIndex, 1);
    const from = parseLocalDateOnly(`2026-${month}-01`);
    const to = parseLocalDateOnly(
      `2026-${month}-${String(lastDay).padStart(2, "0")}`,
      true,
    );

    assert.equal(attendanceDate.getTime(), from.getTime());
    assert.ok(attendanceDate >= from && attendanceDate <= to);
  }
});

test("local date range parsing rejects invalid calendar dates", () => {
  assert.throws(() => parseLocalDateOnly("2026-11-31"), RangeError);
  assert.throws(() => parseLocalDateOnly("2026/11/01"), RangeError);
});
