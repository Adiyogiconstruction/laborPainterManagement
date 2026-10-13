import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import AdminActivity from "../models/AdminActivity.js";
import AdminSession from "../models/AdminSession.js";
import { allowRoles, requireAuth, signToken } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { safeUser } from "../utils/serializers.js";
import { rateLimit } from "express-rate-limit";
import {
  clearSessionCookie,
  SESSION_DURATION_SECONDS,
  setSessionCookie,
} from "../utils/session.js";
import {
  currentUsageDate,
  getUsageDateRange,
  getUsagePeriodRange,
  summarizeAdminUsage,
  summarizeAdminUsageByDay,
} from "../utils/adminUsage.js";
import {
  summarizeAdminActivity,
  recordAdminActivity,
} from "../utils/adminActivity.js";
import {
  createCaptchaChallenge,
  verifyCaptchaChallenge,
} from "../utils/captcha.js";
import {
  createOwnerPasswordResetToken,
  hashOwnerPasswordResetToken,
  OWNER_PASSWORD_RESET_TTL_MS,
} from "../utils/ownerPasswordReset.js";
import {
  assertOwnerPasswordResetEmailConfigured,
  sendOwnerPasswordResetEmail,
} from "../services/ownerPasswordResetEmail.js";

const router = Router();
const startAdminSession = async (user) => {
  const startedAt = new Date();
  return AdminSession.create({
    user: user._id,
    startedAt,
    lastSeenAt: startedAt,
    expiresAt: new Date(
      startedAt.getTime() + SESSION_DURATION_SECONDS * 1000,
    ),
  });
};
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many authentication attempts. Try again later." },
});
const passwordResetRequestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many password recovery requests. Try again later." },
});
const passwordResetConfirmRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many password reset attempts. Try again later." },
});

router.get(
  "/captcha",
  asyncHandler(async (_req, res) => {
    const challenge = createCaptchaChallenge(process.env.JWT_SECRET);
    res.json({
      token: challenge.token,
      image: `data:image/svg+xml,${encodeURIComponent(challenge.image)}`,
    });
  }),
);

router.get(
  "/setup-status",
  asyncHandler(async (_req, res) => {
    res.json({ needsSetup: (await User.countDocuments()) === 0 });
  }),
);

router.post(
  "/setup",
  authRateLimit,
  asyncHandler(async (req, res) => {
    if (
      !verifyCaptchaChallenge(
        req.body.captchaToken,
        req.body.captchaCode,
        process.env.JWT_SECRET,
      )
    ) {
      throw new ApiError(400, "CAPTCHA is incorrect or expired. Try again.");
    }
    if (await User.countDocuments())
      throw new ApiError(409, "The workspace has already been set up.");
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      throw new ApiError(400, "Name, email and password are required.");
    if (String(password).length < 8 || String(password).length > 128)
      throw new ApiError(400, "Password must be between 8 and 128 characters.");
    const user = await User.create({ name, email, password, role: "OWNER" });
    await recordAdminActivity(
      { user },
      "SETUP",
      `${user.name} completed the workspace setup.`,
    );
    const session = await startAdminSession(user);
    setSessionCookie(res, signToken(user, session.id));
    res.status(201).json({ user: safeUser(user) });
  }),
);

router.post(
  "/login",
  authRateLimit,
  asyncHandler(async (req, res) => {
    if (
      !verifyCaptchaChallenge(
        req.body.captchaToken,
        req.body.captchaCode,
        process.env.JWT_SECRET,
      )
    ) {
      throw new ApiError(400, "CAPTCHA is incorrect or expired. Try again.");
    }
    const { email, password } = req.body;
    if (!email || !password)
      throw new ApiError(400, "Email and password are required.");
    if (String(email).length > 254 || String(password).length > 128)
      throw new ApiError(400, "Invalid email or password.");
    const user = await User.findOne({
      email: String(email).toLowerCase(),
    }).select("+password");
    if (!user || !user.active || !(await user.matchesPassword(password)))
      throw new ApiError(401, "Incorrect email or password.");
    await AdminActivity.create({
      user: user._id,
      userName: user.name,
      role: user.role,
      action: "LOGIN",
      message: `${user.name} logged in successfully.`,
    });
    const session = await startAdminSession(user);
    setSessionCookie(res, signToken(user, session.id));
    res.json({ user: safeUser(user) });
  }),
);

router.post(
  "/password-reset/request",
  passwordResetRequestRateLimit,
  asyncHandler(async (req, res) => {
    if (
      !verifyCaptchaChallenge(
        req.body.captchaToken,
        req.body.captchaCode,
        process.env.JWT_SECRET,
      )
    ) {
      throw new ApiError(400, "CAPTCHA is incorrect or expired. Try again.");
    }
    const email = String(req.body.email || "").trim().toLowerCase();
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new ApiError(400, "Enter a valid email address.");
    }
    const user = await User.findOne({ email, role: "OWNER", active: true });
    if (!user) {
      throw new ApiError(
        404,
        "This email does not match an active owner account. Enter the owner's registered email address.",
      );
    }
    let mailConfig;
    try {
      mailConfig = assertOwnerPasswordResetEmailConfigured();
    } catch (error) {
      throw new ApiError(503, error.message);
    }

    const token = createOwnerPasswordResetToken();
    const tokenHash = hashOwnerPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + OWNER_PASSWORD_RESET_TTL_MS);
    const tokenUpdate = await User.updateOne(
      { _id: user._id, role: "OWNER", active: true },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      },
    );
    if (!tokenUpdate.matchedCount) {
      throw new ApiError(
        404,
        "This email does not match an active owner account. Enter the owner's registered email address.",
      );
    }

    try {
      await sendOwnerPasswordResetEmail({ user, token, mailConfig });
    } catch (error) {
      await User.updateOne(
        { _id: user._id, passwordResetTokenHash: tokenHash },
        {
          $set: {
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
          },
        },
      );
      console.error("Owner password recovery email delivery failed.", {
        code: error.code,
        responseCode: error.responseCode,
        command: error.command,
      });
      throw new ApiError(
        503,
        "Recovery email could not be sent. Check SMTP configuration or contact the system administrator.",
      );
    }

    res.status(202).json({
      message:
        "If an active owner account exists for that email, a recovery link will be sent.",
    });
  }),
);

router.post(
  "/password-reset/confirm",
  passwordResetConfirmRateLimit,
  asyncHandler(async (req, res) => {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    if (!token || token.length > 200) {
      throw new ApiError(400, "This recovery link is invalid or expired.");
    }
    if (password.length < 8 || password.length > 128) {
      throw new ApiError(400, "Password must be between 8 and 128 characters.");
    }

    const tokenHash = hashOwnerPasswordResetToken(token);
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.findOneAndUpdate(
      {
        role: "OWNER",
        active: true,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          password: hashedPassword,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      },
      { new: true },
    ).select("_id name role");

    if (!user) {
      throw new ApiError(400, "This recovery link is invalid or expired.");
    }

    await AdminSession.updateMany(
      { user: user._id, endedAt: null },
      { $set: { endedAt: new Date() } },
    );
    await recordAdminActivity(
      { user },
      "PASSWORD_RESET",
      `${user.name} reset the owner password using email recovery.`,
      { method: "EMAIL_RECOVERY" },
    );
    res.json({
      ok: true,
      message: "Password reset successfully. Sign in with your new password.",
    });
  }),
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.sessionId) {
      await AdminSession.updateOne(
        {
          _id: req.sessionId,
          user: req.user._id,
          endedAt: null,
        },
        { $set: { endedAt: new Date() } },
      );
    }
    await AdminActivity.create({
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "LOGOUT",
      message: `${req.user.name} logged out.`,
    });
    clearSessionCookie(res);
    res.status(204).end();
  }),
);

router.get("/me", requireAuth, (req, res) =>
  res.json({ user: safeUser(req.user) }),
);

router.post(
  "/session/heartbeat",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await AdminSession.updateOne(
      {
        _id: req.sessionId,
        user: req.user._id,
        endedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { lastSeenAt: new Date() } },
    );
    if (!result.matchedCount) {
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
    res.status(204).end();
  }),
);

router.get(
  "/admins",
  requireAuth,
  allowRoles("OWNER"),
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users: users.map(safeUser) });
  }),
);

router.get(
  "/admins/activity",
  requireAuth,
  allowRoles("OWNER"),
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    const events = await AdminActivity.find().sort({ createdAt: -1 });
    const grouped = new Map();
    for (const event of events) {
      const key = String(event.user);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(event.toObject());
    }
    const admins = users.map((user) => {
      const userEvents = grouped.get(String(user._id)) || [];
      return {
        ...safeUser(user),
        ...summarizeAdminActivity(userEvents),
      };
    });
    res.json({ admins });
  }),
);

router.get(
  "/admins/usage",
  requireAuth,
  allowRoles("OWNER"),
  asyncHandler(async (req, res) => {
    if (req.query.from !== undefined || req.query.to !== undefined) {
      let range;
      try {
        range = getUsageDateRange(
          String(req.query.from || ""),
          String(req.query.to || ""),
        );
      } catch (error) {
        throw new ApiError(400, error.message);
      }
      const now = new Date();
      const periodEnd = new Date(Math.min(range.end.getTime(), now.getTime()));
      const [users, sessions] = await Promise.all([
        User.find().sort({ createdAt: -1 }),
        periodEnd > range.start
          ? AdminSession.find({
              startedAt: { $lt: periodEnd },
              expiresAt: { $gt: range.start },
              $or: [{ endedAt: null }, { endedAt: { $gt: range.start } }],
            }).select("user startedAt lastSeenAt expiresAt endedAt")
          : [],
      ]);
      const sessionsByUser = new Map();
      for (const session of sessions) {
        const key = String(session.user);
        if (!sessionsByUser.has(key)) sessionsByUser.set(key, []);
        sessionsByUser.get(key).push(session);
      }
      const rows = users.flatMap((user) =>
        summarizeAdminUsageByDay(
          sessionsByUser.get(String(user._id)) || [],
          String(req.query.from),
          String(req.query.to),
          now,
        ).map((summary) => ({
          userId: user.id,
          userName: user.name,
          ...summary,
        })),
      ).sort(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          left.userName.localeCompare(right.userName),
      );
      res.json({
        from: String(req.query.from),
        to: String(req.query.to),
        rows,
      });
      return;
    }

    const period = String(req.query.period || "day");
    const dateValue = req.query.date || currentUsageDate();
    let range;
    try {
      range = getUsagePeriodRange(period, String(dateValue));
    } catch (error) {
      throw new ApiError(400, error.message);
    }

    const now = new Date();
    const currentPeriodEnd = new Date(
      Math.min(range.end.getTime(), now.getTime()),
    );
    const [users, sessions] = await Promise.all([
      User.find().sort({ createdAt: -1 }),
      currentPeriodEnd > range.start
        ? AdminSession.find({
            startedAt: { $lt: currentPeriodEnd },
            expiresAt: { $gt: range.start },
            $or: [{ endedAt: null }, { endedAt: { $gt: range.start } }],
          }).select("user startedAt lastSeenAt expiresAt endedAt")
        : [],
    ]);
    const sessionsByUser = new Map();
    for (const session of sessions) {
      const key = String(session.user);
      if (!sessionsByUser.has(key)) sessionsByUser.set(key, []);
      sessionsByUser.get(key).push(session);
    }

    res.json({
      period,
      date: String(dateValue),
      start: range.start,
      end: range.end,
      admins: users.map((user) => ({
        id: user.id,
        name: user.name,
        role: user.role,
        active: user.active,
        ...summarizeAdminUsage(
          sessionsByUser.get(String(user._id)) || [],
          range.start,
          range.end,
          now,
        ),
      })),
    });
  }),
);

router.post(
  "/admins",
  requireAuth,
  allowRoles("OWNER"),
  asyncHandler(async (req, res) => {
    const { name, email, password, role = "ADMIN" } = req.body;
    if (!name || !email || !password)
      throw new ApiError(400, "Name, email and password are required.");
    if (String(password).length < 8 || String(password).length > 128)
      throw new ApiError(400, "Password must be between 8 and 128 characters.");
    if (!["ADMIN", "VIEWER"].includes(role))
      throw new ApiError(400, "Invalid admin role.");
    const user = await User.create({ name, email, password, role });
    await recordAdminActivity(
      req,
      "CREATE",
      `${req.user.name} created admin account for ${user.name}.`,
      {
        adminId: user.id,
        role: user.role,
      },
    );
    res.status(201).json({ user: safeUser(user) });
  }),
);

router.patch(
  "/admins/:id",
  requireAuth,
  allowRoles("OWNER"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, "Admin not found.");
    if (user.id === req.user.id && req.body.active === false)
      throw new ApiError(400, "You cannot deactivate your own account.");
    if (
      req.body.role !== undefined &&
      !["ADMIN", "VIEWER"].includes(req.body.role)
    )
      throw new ApiError(400, "Invalid admin role.");
    const previousRole = user.role;
    const previousActive = user.active;
    ["name", "role", "active"].forEach((field) => {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    });
    await user.save();
    if (previousActive && user.active === false) {
      await AdminSession.updateMany(
        { user: user._id, endedAt: null },
        { $set: { endedAt: new Date() } },
      );
    }
    if (req.body.role !== undefined && req.body.role !== previousRole) {
      await recordAdminActivity(
        req,
        "ROLE_CHANGE",
        `${req.user.name} changed ${user.name}'s role from ${previousRole} to ${user.role}.`,
        {
          targetId: user.id,
          previousRole,
          newRole: user.role,
        },
      );
    }
    if (req.body.active !== undefined && req.body.active !== previousActive) {
      await recordAdminActivity(
        req,
        "ACCESS_TOGGLE",
        `${req.user.name} ${user.active ? "enabled" : "disabled"} ${user.name}'s account.`,
        {
          targetId: user.id,
          previousActive,
          newActive: user.active,
        },
      );
    }
    res.json({ user: safeUser(user) });
  }),
);

router.delete(
  "/admins/:id/permanent",
  requireAuth,
  allowRoles("OWNER"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, "Admin not found.");
    if (user.id === req.user.id)
      throw new ApiError(400, "You cannot permanently delete your own account.");
    if (user.role === "OWNER")
      throw new ApiError(400, "Owner accounts cannot be permanently deleted here.");

    await User.findByIdAndDelete(user._id);
    await AdminSession.deleteMany({ user: user._id });
    await recordAdminActivity(
      req,
      "DELETE",
      `${req.user.name} permanently deleted admin account for ${user.name}.`,
      {
        targetId: user.id,
        targetName: user.name,
        targetEmail: user.email,
        role: user.role,
        permanent: true,
      },
    );
    res.json({ deletedId: user.id });
  }),
);

router.patch(
  "/admins/:id/password",
  requireAuth,
  allowRoles("OWNER"),
  asyncHandler(async (req, res) => {
    const password = String(req.body.password || "");
    if (password.length < 8)
      throw new ApiError(400, "Password must be at least 8 characters.");
    const user = await User.findById(req.params.id).select("+password");
    if (!user) throw new ApiError(404, "Admin not found.");
    if (user.role === "OWNER")
      throw new ApiError(
        400,
        "Owner password cannot be reset from admin access.",
      );
    user.password = password;
    await user.save();
    await recordAdminActivity(
      req,
      "PASSWORD_RESET",
      `${req.user.name} reset the password for ${user.name}.`,
      {
        targetId: user.id,
      },
    );
    res.json({ ok: true });
  }),
);

export default router;
