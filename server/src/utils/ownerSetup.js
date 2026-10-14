import { timingSafeEqual } from "node:crypto";

export const OWNER_SETUP_KEY_MIN_LENGTH = 32;

export function isOwnerSetupEnabled(configuredKey = process.env.OWNER_SETUP_KEY) {
  return (
    typeof configuredKey === "string" &&
    configuredKey.length >= OWNER_SETUP_KEY_MIN_LENGTH
  );
}

export function matchesOwnerSetupKey(
  providedKey,
  configuredKey = process.env.OWNER_SETUP_KEY,
) {
  if (
    !isOwnerSetupEnabled(configuredKey) ||
    typeof providedKey !== "string"
  ) {
    return false;
  }

  const providedBytes = Buffer.from(providedKey, "utf8");
  const configuredBytes = Buffer.from(configuredKey, "utf8");
  return (
    providedBytes.length === configuredBytes.length &&
    timingSafeEqual(providedBytes, configuredBytes)
  );
}
