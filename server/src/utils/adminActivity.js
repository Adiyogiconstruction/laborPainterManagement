import AdminActivity from "../models/AdminActivity.js";

export function summarizeAdminActivity(events = []) {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(b.createdAt || b.created_at || 0) -
      new Date(a.createdAt || a.created_at || 0),
  );

  const lastLogin = sorted.find((event) => event.action === "LOGIN");
  const lastLogout = sorted.find((event) => event.action === "LOGOUT");

  return {
    lastLoginAt: lastLogin?.createdAt || null,
    lastLogoutAt: lastLogout?.createdAt || null,
    recentChanges: sorted
      .filter((event) =>
        [
          "UPDATE",
          "CREATE",
          "DELETE",
          "PASSWORD_RESET",
          "ACCESS_TOGGLE",
          "ROLE_CHANGE",
        ].includes(event.action),
      )
      .slice(0, 10)
      .map((event) => ({
        action: event.action,
        message: event.message,
        createdAt: event.createdAt,
      })),
  };
}

export async function recordAdminActivity(actor, action, message, meta = {}) {
  let user = actor;
  if (actor && actor.user) user = actor.user;
  if (!user || (!user._id && !user.id)) return null;

  return AdminActivity.create({
    user: user._id || user.id,
    userName: user.name,
    role: user.role || "ADMIN",
    action,
    message: String(message || action).slice(0, 300),
    meta,
  });
}
