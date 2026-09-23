import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { getSessionToken } from "../utils/session.js";

const secret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is required. Configure it in the server environment.",
    );
  }
  return process.env.JWT_SECRET;
};

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret(), {
    expiresIn: "8h",
  });
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = getSessionToken(req);
  if (!token) throw new ApiError(401, "Login is required.");

  try {
    const payload = jwt.verify(token, secret());
    const user = await User.findById(payload.sub);
    if (!user || !user.active)
      throw new ApiError(401, "This account is no longer active.");
    req.user = user;
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
