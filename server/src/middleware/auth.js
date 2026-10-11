import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AdminSession from "../models/AdminSession.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import {
  getSessionToken,
  SESSION_DURATION_SECONDS,
} from "../utils/session.js";

const secret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is required. Configure it in the server environment.",
    );
  }
  return process.env.JWT_SECRET;
};

export function signToken(user, sessionId) {
  return jwt.sign(
    { sub: user.id, role: user.role, ...(sessionId ? { sid: sessionId } : {}) },
    secret(),
    {
      expiresIn: `${SESSION_DURATION_SECONDS}s`,
    },
  );
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = getSessionToken(req);
  if (!token) throw new ApiError(401, "Login is required.");

  try {
    const payload = jwt.verify(token, secret());
    const user = await User.findById(payload.sub);
    if (!user || !user.active)
      throw new ApiError(401, "This account is no longer active.");
    if (!payload.sid) {
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
    const session = await AdminSession.findOne({
      _id: payload.sid,
      user: user._id,
      endedAt: null,
      expiresAt: { $gt: new Date() },
    }).select("_id");
    if (!session) {
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
    req.user = user;
    req.sessionId = payload.sid || null;
    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }
});

export const allowRoles =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role))
      return next(
        new ApiError(403, "You do not have permission for this action."),
      );
    next();
  };
