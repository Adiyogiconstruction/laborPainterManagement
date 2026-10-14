export function sumNetPaymentsForWorkers(payments, workerIds) {
  const selectedWorkerIds = new Set([...workerIds].map(String));
  return payments.reduce((total, payment) => {
    const workerId = payment.worker?._id ?? payment.worker;
    if (!workerId || !selectedWorkerIds.has(String(workerId))) return total;

    const amount = Number(payment.amount);
    if (!Number.isFinite(amount)) return total;
    if (payment.flow === "INFLOW") return total - amount;
    if (payment.flow === "OUTFLOW") return total + amount;
    return total;
  }, 0);
}

export function calculateAttendanceBalance(totalPayable, alreadyPaid) {
  return Number(totalPayable) - Number(alreadyPaid);
}
