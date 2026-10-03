import assert from "node:assert/strict";
import test from "node:test";
import { appendWorkerStatusTransition } from "./workerStatusHistory.js";

test("status changes append transitions and retain an unknown legacy baseline", () => {
  const changedAt = new Date("2026-10-03T10:00:00.000Z");
  const history = appendWorkerStatusTransition([], true, false, changedAt);

  assert.deepEqual(history, [
    { active: true, changedAt: null },
    { active: false, changedAt },
  ]);
});

test("status changes preserve known periods without mutating previous history", () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const changedAt = new Date("2026-10-03T10:00:00.000Z");
  const original = [{ active: true, changedAt: startedAt }];
  const updated = appendWorkerStatusTransition(
    original,
    true,
    false,
    changedAt,
  );

  assert.equal(original.length, 1);
  assert.deepEqual(updated, [
    { active: true, changedAt: startedAt },
    { active: false, changedAt },
  ]);
});

test("unchanged status does not create a duplicate period", () => {
  const history = [{ active: true, changedAt: new Date() }];

  assert.deepEqual(appendWorkerStatusTransition(history, true, true), history);
});
