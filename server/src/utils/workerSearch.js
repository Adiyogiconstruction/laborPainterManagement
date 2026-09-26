export const parseWorkerSearch = (rawSearch = "") => {
  const search = String(rawSearch || "").trim();
  if (!search) return { status: undefined, remaining: "" };

  const lower = search.toLowerCase();
  const statusPattern =
    /(inactive|inactie|incative|in-active|not active|notactive|disabled|active|available|live)/gi;

  let status;
  if (
    /(inactive|inactie|incative|in-active|not active|notactive|disabled)/i.test(
      lower,
    )
  ) {
    status = false;
  } else if (/(active|available|live)/i.test(lower)) {
    status = true;
  }

  const remaining = search
    .replace(statusPattern, "")
    .replace(/\s+/g, " ")
    .trim();

  return { status, remaining };
};
