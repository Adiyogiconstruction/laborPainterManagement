import assert from "node:assert/strict";
import test from "node:test";
import {
  createCaptchaChallenge,
  verifyCaptchaChallenge,
} from "./captcha.js";

const secret = "test-secret";

test("CAPTCHA challenge accepts the displayed code and rejects incorrect answers", () => {
  const challenge = createCaptchaChallenge(secret);
  const answer = [...challenge.image.matchAll(/>([A-HJ-NP-Z2-9])<\/text>/g)]
    .map((match) => match[1])
    .join("");

  assert.equal(answer.length, 6);
  assert.equal(verifyCaptchaChallenge(challenge.token, answer, secret), true);
  assert.equal(verifyCaptchaChallenge(challenge.token, "AAAAAA", secret), false);
  assert.equal(
    verifyCaptchaChallenge(challenge.token, answer.toLowerCase(), secret),
    true,
  );
});

test("CAPTCHA challenge rejects tampered, expired, and missing tokens", () => {
  const now = 1_000_000;
  const challenge = createCaptchaChallenge(secret, now);
  const answer = [...challenge.image.matchAll(/>([A-HJ-NP-Z2-9])<\/text>/g)]
    .map((match) => match[1])
    .join("");

  assert.equal(
    verifyCaptchaChallenge(`${challenge.token}x`, answer, secret, now),
    false,
  );
  assert.equal(
    verifyCaptchaChallenge(challenge.token, answer, secret, now + 300_000),
    false,
  );
  assert.equal(verifyCaptchaChallenge("", answer, secret, now), false);
});
