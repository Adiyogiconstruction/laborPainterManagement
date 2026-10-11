import { createHash, randomBytes } from "node:crypto";

export const OWNER_PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function createOwnerPasswordResetToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOwnerPasswordResetToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function createOwnerPasswordResetUrl(token, clientOrigin) {
  if (!clientOrigin) {
    throw new Error("CLIENT_ORIGIN is required to create a password reset URL.");
  }
  const url = new URL(clientOrigin);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("CLIENT_ORIGIN must use HTTP or HTTPS.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("CLIENT_ORIGIN must use HTTPS in production.");
  }
  if (url.username || url.password) {
    throw new Error("CLIENT_ORIGIN must not include credentials.");
  }
  url.search = "";
  url.hash = new URLSearchParams({ resetToken: token }).toString();
  return url.toString();
}
