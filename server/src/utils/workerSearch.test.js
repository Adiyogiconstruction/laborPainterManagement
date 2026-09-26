import test from "node:test";
import assert from "node:assert/strict";
import { parseWorkerSearch } from "./workerSearch.js";

test("matches active and inactive worker status keywords in text searches", () => {
  assert.deepEqual(parseWorkerSearch("active labour"), {
    status: true,
    remaining: "labour",
  });

  assert.deepEqual(parseWorkerSearch("inactive workers"), {
    status: false,
    remaining: "workers",
  });

  assert.deepEqual(parseWorkerSearch("inactie team"), {
    status: false,
    remaining: "team",
  });

  assert.deepEqual(parseWorkerSearch("ankit"), {
    status: undefined,
    remaining: "ankit",
  });
});
