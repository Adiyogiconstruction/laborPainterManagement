export const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
export const number = (value) =>
  new Intl.NumberFormat("en-IN").format(Number(value || 0));
export const date = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "—";
export const inputDate = (value = new Date()) =>
  new Date(value).toISOString().slice(0, 10);
export const nameOf = (entity) =>
  typeof entity === "object" ? entity?.name : entity;
export const valueOr = (form, key, fallback = "") => form[key] ?? fallback;
