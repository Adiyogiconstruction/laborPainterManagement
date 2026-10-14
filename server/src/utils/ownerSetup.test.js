import assert from "node:assert/strict";
import test from "node:test";
import {
  isOwnerSetupEnabled,
  matchesOwnerSetupKey,
  OWNER_SETUP_KEY_MIN_LENGTH,
} from "./ownerSetup.js";

const setupKey = "a".repeat(OWNER_SETUP_KEY_MIN_LENGTH);

test("enables owner setup only when a sufficiently long key is configured", () => {
  assert.equal(isOwnerSetupEnabled(setupKey), true);
  assert.equal(isOwnerSetupEnabled("short"), false);
  assert.equal(isOwnerSetupEnabled(""), false);
  assert.equal(isOwnerSetupEnabled(undefined), false);
});

test("matches the private setup key without accepting partial or missing values", () => {
  assert.equal(matchesOwnerSetupKey(setupKey, setupKey), true);
  assert.equal(matchesOwnerSetupKey(`${setupKey}x`, setupKey), false);
  assert.equal(matchesOwnerSetupKey(setupKey.slice(1), setupKey), false);
  assert.equal(matchesOwnerSetupKey(undefined, setupKey), false);
  assert.equal(matchesOwnerSetupKey(setupKey, "short"), false);
});
