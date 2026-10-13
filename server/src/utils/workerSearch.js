export const parseWorkerSearch = (rawSearch = "") => {
  const search = String(rawSearch || "").trim();
  if (!search) return { status: undefined, remaining: "" };

  const lower = search.toLowerCase();
  const statusPattern =
    /(went\s*home|went-home|inactive|inactie|incative|in-active|not active|notactive|disabled|active|available|live)/gi;

  let status;
  if (
    /(went\s*home|went-home)/i.test(lower)
  ) {
    status = "WENT_HOME";
  } else if (
    /(inactive|inactie|incative|in-active|not active|notactive|disabled)/i.test(
      lower,
    )
  ) {
    status = "INACTIVE";
  } else if (/(active|available|live)/i.test(lower)) {
    status = "ACTIVE";
  }

  const remaining = search
    .replace(statusPattern, "")
    .replace(/\s+/g, " ")
    .trim();

  return { status, remaining };
};
