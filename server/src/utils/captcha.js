import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const captchaAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const captchaLength = 6;
const challengeLifetimeMs = 5 * 60 * 1000;

const answerDigest = (answer, secret) =>
  createHmac("sha256", secret)
    .update(answer.toUpperCase())
    .digest("base64url");

const signPayload = (payload, secret) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export function createCaptchaSvg(code) {
  const glyphs = [...code].map((character, index) => {
    const x = 20 + index * 35;
    const rotation = randomInt(-8, 9);
    const y = randomInt(45, 54);
    return `<text x="${x}" y="${y}" transform="rotate(${rotation} ${x} ${y})">${character}</text>`;
  });
  const noise = Array.from({ length: 5 }, () => {
    const x1 = randomInt(0, 220);
    const y1 = randomInt(0, 72);
    const x2 = randomInt(0, 220);
    const y2 = randomInt(0, 72);
    return `<path d="M${x1} ${y1} L${x2} ${y2}"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="72" viewBox="0 0 220 72" role="img" aria-label="CAPTCHA code"><rect width="220" height="72" rx="8" fill="#fff0df"/><g fill="none" stroke="#d9893d" stroke-width="1.2" opacity=".55">${noise.join("")}</g><g fill="#713900" font-family="Arial,sans-serif" font-size="29" font-weight="700" letter-spacing="1">${glyphs.join("")}</g></svg>`;
}

export function createCaptchaChallenge(secret, now = Date.now()) {
  if (!secret) throw new Error("JWT_SECRET is required to create a CAPTCHA.");
  let answer = "";
  for (let index = 0; index < captchaLength; index += 1) {
    answer += captchaAlphabet[randomInt(0, captchaAlphabet.length)];
  }

  const payload = Buffer.from(
    JSON.stringify({
      answer: answerDigest(answer, secret),
      expiresAt: now + challengeLifetimeMs,
    }),
  ).toString("base64url");
  const token = `${payload}.${signPayload(payload, secret)}`;
  return { token, image: createCaptchaSvg(answer) };
}

export function verifyCaptchaChallenge(token, answer, secret, now = Date.now()) {
  if (typeof token !== "string" || typeof answer !== "string" || !secret) {
    return false;
  }
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return false;

  const expectedSignature = signPayload(payload, secret);
  const providedSignatureBytes = Buffer.from(signature);
  const expectedSignatureBytes = Buffer.from(expectedSignature);
  if (
    providedSignatureBytes.length !== expectedSignatureBytes.length ||
    !timingSafeEqual(providedSignatureBytes, expectedSignatureBytes)
  ) {
    return false;
  }

  try {
    const challenge = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      !Number.isFinite(challenge.expiresAt) ||
      challenge.expiresAt <= now ||
      typeof challenge.answer !== "string"
    ) {
      return false;
    }
    const providedAnswerBytes = Buffer.from(
      answerDigest(answer.trim(), secret),
    );
    const expectedAnswerBytes = Buffer.from(challenge.answer);
    return (
      providedAnswerBytes.length === expectedAnswerBytes.length &&
      timingSafeEqual(providedAnswerBytes, expectedAnswerBytes)
    );
  } catch {
    return false;
  }
}
