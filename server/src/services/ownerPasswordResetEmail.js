import nodemailer from "nodemailer";
import { createOwnerPasswordResetUrl } from "../utils/ownerPasswordReset.js";

function mailConfiguration() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim();
  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !user ||
    !password ||
    !from
  ) {
    throw new Error(
      "Owner password recovery mail is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.",
    );
  }
  if (
    (secureValue && !["true", "false"].includes(secureValue)) ||
    /[\r\n]/.test(from)
  ) {
    throw new Error("SMTP_SECURE or SMTP_FROM is invalid.");
  }
  return {
    host,
    port,
    secure: secureValue ? secureValue === "true" : port === 465,
    auth: { user, pass: password },
    from,
  };
}

export function assertOwnerPasswordResetEmailConfigured() {
  return mailConfiguration();
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export async function sendOwnerPasswordResetEmail({
  user,
  token,
  mailConfig = mailConfiguration(),
}) {
  const clientOrigin =
    process.env.CLIENT_ORIGIN?.split(",")[0]?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173");
  const resetUrl = createOwnerPasswordResetUrl(token, clientOrigin);
  const transporter = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    requireTLS: !mailConfig.secure,
    auth: mailConfig.auth,
  });
  await transporter.sendMail({
    from: mailConfig.from,
    to: user.email,
    subject: "Reset your owner password",
    text: [
      `Hello ${user.name},`,
      "",
      "A password reset was requested for the owner account in your workforce workspace.",
      `Set a new password using this one-time link (expires in 30 minutes): ${resetUrl}`,
      "",
      "If you did not request this, you can ignore this email. Your password will not change.",
    ].join("\n"),
    html: `<p>Hello ${escapeHtml(user.name)},</p><p>A password reset was requested for the owner account in your workforce workspace.</p><p><a href="${escapeHtml(resetUrl)}">Set a new password</a></p><p>This one-time link expires in 30 minutes.</p><p>If you did not request this, you can ignore this email. Your password will not change.</p>`,
  });
}
