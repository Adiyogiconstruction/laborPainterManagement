export const balanceType = (worker) => {
  if (Number(worker.totalDue || 0) > 0) return "DENA_HAI";
  if (Number(worker.overpaid || 0) > 0) return "LENA_HAI";
  return "SETTLED";
};

export function filterAndSortWorkers(
  workers,
  {
    search = "",
    company = "",
    team = "",
    zone = "",
    status = "ALL",
    balance = "ALL",
    sort = "RECENT",
  } = {},
) {
  const query = search.trim().toLocaleLowerCase();
  const result = workers.filter((worker) => {
    if (company && worker.companyName !== company) return false;
    if (team && worker.teamName !== team) return false;
    if (zone && worker.workZone !== zone) return false;
    const labourStatus =
      worker.labourStatus || (worker.active ? "ACTIVE" : "INACTIVE");
    if (status !== "ALL" && status && labourStatus !== status) return false;
    const type = balanceType(worker);
    if (balance === "DUE" && type !== "DENA_HAI") return false;
    if (balance === "OVERPAID" && type !== "LENA_HAI") return false;
    if (!query) return true;
    return [
      worker.name,
      worker.phone,
      worker.companyName,
      worker.teamName,
      worker.workZone,
    ].some((value) =>
      String(value || "")
        .toLocaleLowerCase()
        .includes(query),
    );
  });

  return result.sort((left, right) => {
    const leftBalance = Number(left.totalDue || 0) - Number(left.overpaid || 0);
    const rightBalance =
      Number(right.totalDue || 0) - Number(right.overpaid || 0);
    if (sort === "BALANCE_HIGH") {
      return rightBalance - leftBalance || left.name.localeCompare(right.name);
    }
    if (sort === "BALANCE_LOW") {
      return leftBalance - rightBalance || left.name.localeCompare(right.name);
    }
    if (sort === "NAME") return left.name.localeCompare(right.name);
    const recency =
      new Date(right.lastPaymentOn || right.joiningDate || 0) -
      new Date(left.lastPaymentOn || left.joiningDate || 0);
    return recency || left.name.localeCompare(right.name);
  });
}

export function paymentBalances(payments, currentBalance) {
  let balance = Number(currentBalance || 0);
  return [...payments]
    .sort((left, right) => new Date(right.paidOn) - new Date(left.paidOn))
    .map((payment) => {
      const balanceAfter = balance;
      balance +=
        (payment.flow === "INFLOW" ? -1 : 1) * Number(payment.amount || 0);
      return { ...payment, balanceAfter };
    });
}

export function buildPaymentReminder(worker) {
  const due = Number(worker.totalDue || 0);
  const amount = due > 0 ? due : Number(worker.overpaid || 0);
  const status = due > 0 ? "payable" : "advance balance";
  return `Hello ${worker.name}, your labour account currently shows ${status} of ₹${amount.toLocaleString("en-IN")}. Please contact us if you have any questions.`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const source = String(text).replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value === "") {
      quoted = true;
    } else if (character === ",") {
      row.push(value.trim());
      value = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("CSV has an unclosed quoted value.");
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}
