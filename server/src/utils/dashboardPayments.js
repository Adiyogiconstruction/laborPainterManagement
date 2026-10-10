const isSelectedWorkerPayment = (payment, selectedWorkerIds) =>
  selectedWorkerIds.has(String(payment.worker?._id || payment.worker || ""));

export function summarizeDashboardPayments(payments, selectedWorkerIds) {
  let paid = 0;
  let advancePaid = 0;
  let expenseTotal = 0;
  let otherOutflowTotal = 0;
  const paymentKinds = {};
  const expenseBreakdown = new Map();

  for (const payment of payments) {
    const amount = Number(payment.amount || 0);
    const isInflow = payment.flow === "INFLOW";
    const selectedWorkerPayment = isSelectedWorkerPayment(
      payment,
      selectedWorkerIds,
    );
    paymentKinds[payment.kind] =
      (paymentKinds[payment.kind] || 0) + (isInflow ? -amount : amount);

    if (selectedWorkerPayment) {
      paid += isInflow ? -amount : amount;
    }

    if (isInflow) continue;
    if (payment.kind === "EXPENSE") {
      const category = String(payment.notes || "").trim() || "Kharchi";
      expenseTotal += amount;
      expenseBreakdown.set(
        category,
        (expenseBreakdown.get(category) || 0) + amount,
      );
    } else if (
      selectedWorkerPayment &&
      ["ADVANCE", "TRAVEL_ADVANCE"].includes(payment.kind)
    ) {
      advancePaid += amount;
      expenseBreakdown.set(
        "Advance",
        (expenseBreakdown.get("Advance") || 0) + amount,
      );
    } else if (
      selectedWorkerPayment &&
      ["OTHER", "ADJUSTMENT"].includes(payment.kind)
    ) {
      const category = String(payment.notes || "").trim() || "Other Reasons";
      otherOutflowTotal += amount;
      expenseBreakdown.set(
        category,
        (expenseBreakdown.get(category) || 0) + amount,
      );
    }
  }

  return {
    paid,
    advancePaid,
    expenseTotal,
    otherOutflowTotal,
    paymentKinds,
    expenseBreakdown: [...expenseBreakdown.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5),
  };
}
