import { Router } from "express";
import User from "../models/User.js";
import AdminActivity from "../models/AdminActivity.js";
import { allowRoles, requireAuth, signToken } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { safeUser } from "../utils/serializers.js";
import { rateLimit } from "express-rate-limit";
import { clearSessionCookie, setSessionCookie } from "../utils/session.js";
import {
  summarizeAdminActivity,
  recordAdminActivity,
} from "../utils/adminActivity.js";

const router = Router();
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many authentication attempts. Try again later." },
});

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
    setSessionCookie(res, signToken(user));
    res.status(201).json({ user: safeUser(user) });
  }),
);

router.post(
  "/login",
  authRateLimit,
  asyncHandler(async (req, res) => {
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
    setSessionCookie(res, signToken(user));
    res.json({ user: safeUser(user) });
  }),
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
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
