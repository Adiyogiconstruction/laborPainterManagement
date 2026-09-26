import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAdminActivity } from "./adminActivity.js";

test("summarizes the latest login, logout and recent changes for an admin", () => {
  const summary = summarizeAdminActivity([
    { user: "admin-1", action: "LOGIN", createdAt: "2026-09-26T08:00:00.000Z" },
    {
      user: "admin-1",
      action: "UPDATE",
      createdAt: "2026-09-26T08:20:00.000Z",
      message: "Updated worker record for Asha.",
    },
    {
      user: "admin-1",
      action: "LOGOUT",
      createdAt: "2026-09-26T09:00:00.000Z",
    },
    {
      user: "admin-1",
      action: "UPDATE",
      createdAt: "2026-09-26T09:30:00.000Z",
      message: "Reset password for Ravi.",
    },
  ]);

  assert.equal(summary.lastLoginAt, "2026-09-26T08:00:00.000Z");
  assert.equal(summary.lastLogoutAt, "2026-09-26T09:00:00.000Z");
  assert.equal(summary.recentChanges.length, 2);
  assert.equal(summary.recentChanges[0].message, "Reset password for Ravi.");
});
