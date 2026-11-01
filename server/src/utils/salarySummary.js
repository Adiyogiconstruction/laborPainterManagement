export function calculateSalaryAmountDue({
  currentMonthPayable,
  paidThisMonth,
  previousDue,
  carryForwardConfirmed,
}) {
  const currentMonthDue = currentMonthPayable - paidThisMonth;
  return currentMonthDue + (carryForwardConfirmed ? previousDue : 0);
}
