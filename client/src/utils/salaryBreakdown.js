import { money } from "./formatters.js";

const formatQuantity = (value) =>
  Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const formatRate = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));

export function createSalaryBreakdown(summary) {
  if (
    !summary ||
    ![
      "workUnits",
      "dailyPayable",
      "overtimeHours",
      "overtimePayable",
      "totalPayable",
      "previousDue",
      "paidThisMonth",
      "amountDue",
    ]
      .every((key) => Number.isFinite(Number(summary[key])))
  ) {
    return null;
  }

  const workUnits = Number(summary.workUnits);
  const dailyPayable = Number(summary.dailyPayable);
  const overtimeHours = Number(summary.overtimeHours);
  const overtimePayable = Number(summary.overtimePayable);
  const total = Number(summary.totalPayable);
  const previousDue = Number(summary.previousDue);
  const paidThisMonth = Number(summary.paidThisMonth);
  const amountDue = Number(summary.amountDue);
  if (
    total <= 0 &&
    previousDue === 0 &&
    paidThisMonth === 0 &&
    amountDue === 0
  ) {
    return null;
  }

  const dailyRate = workUnits > 0 ? dailyPayable / workUnits : 0;
  const overtimeRate =
    overtimeHours > 0 ? overtimePayable / overtimeHours : 0;
  const formulaParts = [];
  if (workUnits > 0) {
    formulaParts.push(
      `${formatQuantity(workUnits)} days × ${formatRate(dailyRate)}`,
    );
  }
  if (overtimeHours > 0) {
    formulaParts.push(
      `(${formatQuantity(overtimeHours)} OT hrs × ${formatRate(overtimeRate)})`,
    );
  }
  if (!formulaParts.length) formulaParts.push("No attendance payable this month");

  return {
    total,
    formula: formulaParts.join(" + "),
    calculation: `${money(dailyPayable)} + ${money(overtimePayable)} = ${money(total)}`,
    previousDue,
    paidThisMonth,
    amountDue,
    monthLabel: summary.month
      ? new Intl.DateTimeFormat("en-IN", {
          month: "long",
          year: "numeric",
        }).format(new Date(`${summary.month}-01T00:00:00`))
      : "",
  };
}
