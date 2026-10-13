import assert from "node:assert/strict";
import test from "node:test";
import { fetchAllPages } from "./fetchAllPages.js";

test("fetches every page and removes duplicate items from shifting offsets", async () => {
  const requests = [];
  const items = Array.from({ length: 1200 }, (_, index) => ({
    _id: String(index),
  }));
  const result = await fetchAllPages(async (skip, limit) => {
    requests.push(skip);
    return { items: items.slice(skip, skip + limit), total: items.length };
  });

  assert.deepEqual(requests, [0, 500, 1000]);
  assert.equal(result.length, 1200);
  assert.equal(new Set(result.map((item) => item._id)).size, 1200);
});

test("rejects malformed pagination metadata instead of silently truncating", async () => {
  await assert.rejects(
    fetchAllPages(async () => ({ items: [] })),
    /paginated response is invalid/,
  );
});
