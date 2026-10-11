import test from "node:test";
import assert from "node:assert/strict";
import {
  createOwnerPasswordResetToken,
  createOwnerPasswordResetUrl,
  hashOwnerPasswordResetToken,
  OWNER_PASSWORD_RESET_TTL_MS,
} from "./ownerPasswordReset.js";
import { assertOwnerPasswordResetEmailConfigured } from "../services/ownerPasswordResetEmail.js";

test("reset tokens are random, URL safe and stored as one-way hashes", () => {
  const first = createOwnerPasswordResetToken();
  const second = createOwnerPasswordResetToken();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.notEqual(hashOwnerPasswordResetToken(first), first);
  assert.equal(hashOwnerPasswordResetToken(first).length, 64);
  assert.equal(OWNER_PASSWORD_RESET_TTL_MS, 30 * 60 * 1000);
});

test("reset URLs keep tokens in the browser fragment", () => {
  const url = new URL(
    createOwnerPasswordResetUrl("secret-token", "https://app.example.com/"),
  );

  assert.equal(url.origin, "https://app.example.com");
  assert.equal(url.search, "");
  assert.equal(
    new URLSearchParams(url.hash.slice(1)).get("resetToken"),
    "secret-token",
  );
});

test("reset URLs reject invalid origins", () => {
  assert.throws(
    () => createOwnerPasswordResetUrl("token", "javascript:alert(1)"),
    /HTTP or HTTPS/,
  );
});

test("reset URLs require HTTPS in production", () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(
      () => createOwnerPasswordResetUrl("token", "http://app.example.com"),
      /HTTPS in production/,
    );
    assert.match(
      createOwnerPasswordResetUrl("token", "https://app.example.com"),
      /^https:\/\//,
    );
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});

test("SMTP settings are required and parsed without exposing credentials", () => {
  const keys = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
  ];
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  try {
    keys.forEach((key) => delete process.env[key]);
    assert.throws(
      () => assertOwnerPasswordResetEmailConfigured(),
      /SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM/,
    );
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_USER = "owner@example.test";
    process.env.SMTP_PASS = "test-only-password";
    process.env.SMTP_FROM = "Workspace <owner@example.test>";
    const config = assertOwnerPasswordResetEmailConfigured();
    assert.equal(config.host, "smtp.example.test");
    assert.equal(config.port, 587);
    assert.equal(config.secure, false);
    assert.equal(config.from, "Workspace <owner@example.test>");
  } finally {
    keys.forEach((key) => {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    });
  }
});
