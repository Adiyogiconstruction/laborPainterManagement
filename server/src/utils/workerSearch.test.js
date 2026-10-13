import test from "node:test";
import assert from "node:assert/strict";
import { parseWorkerSearch } from "./workerSearch.js";

test("matches active and inactive worker status keywords in text searches", () => {
  assert.deepEqual(parseWorkerSearch("active labour"), {
    status: "ACTIVE",
    remaining: "labour",
  });

  assert.deepEqual(parseWorkerSearch("inactive workers"), {
    status: "INACTIVE",
    remaining: "workers",
  });

  assert.deepEqual(parseWorkerSearch("inactie team"), {
    status: "INACTIVE",
    remaining: "team",
  });

  assert.deepEqual(parseWorkerSearch("ankit"), {
    status: undefined,
    remaining: "ankit",
  });

  assert.deepEqual(parseWorkerSearch("went home labour"), {
    status: "WENT_HOME",
    remaining: "labour",
  });
});
