import { parseCookie, stringifySetCookie } from "cookie";

export const SESSION_COOKIE = "workledger_session";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.COOKIE_SAME_SITE || "lax",
  maxAge: SESSION_DURATION_SECONDS,
  path: "/",
};

export function getSessionToken(req) {
  return req.headers.cookie
    ? parseCookie(req.headers.cookie)[SESSION_COOKIE]
    : null;
}

export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    stringifySetCookie({
      name: SESSION_COOKIE,
      value: token,
      ...cookieOptions,
    }),
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    stringifySetCookie({
      name: SESSION_COOKIE,
      value: "",
      ...cookieOptions,
      maxAge: 0,
    }),
  );
}
