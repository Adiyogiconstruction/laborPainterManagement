import CompanyClient from "../models/CompanyClient.js";
import CompanyWorkerRate from "../models/CompanyWorkerRate.js";
import CompanyZoneRate from "../models/CompanyZoneRate.js";

export async function loadCompanyWorkerRateHistory(workers, throughDate) {
  const companyNames = [...new Set(workers.map((worker) => worker.companyName).filter(Boolean))];
  const companies = companyNames.length
    ? await CompanyClient.find({ name: { $in: companyNames } })
        .select("_id name companyLabourRate zones")
        .lean()
    : [];
  const companyByName = new Map(companies.map((company) => [company.name, company]));
  const workerIds = workers.map((worker) => worker._id);
  const companyIds = companies.map((company) => company._id);
  const effectiveThroughDate = new Date(
    Date.UTC(
      throughDate.getFullYear(),
      throughDate.getMonth(),
      throughDate.getDate(),
      23,
      59,
      59,
      999,
    ),
  );
  const history = workerIds.length && companyIds.length
    ? await CompanyWorkerRate.find({
        worker: { $in: workerIds },
        company: { $in: companyIds },
        applicableFrom: { $lte: effectiveThroughDate },
      })
        .sort({ worker: 1, applicableFrom: 1 })
        .lean()
    : [];
  const zoneHistory = companyIds.length
    ? await CompanyZoneRate.find({
        company: { $in: companyIds },
        applicableFrom: { $lte: effectiveThroughDate },
      })
        .sort({ company: 1, zone: 1, applicableFrom: 1 })
        .lean()
    : [];
  const ratesByWorker = new Map();
  for (const rate of history) {
    const key = String(rate.worker);
    if (!ratesByWorker.has(key)) ratesByWorker.set(key, []);
    ratesByWorker.get(key).push(rate);
  }
  const zoneRatesByCompanyZone = new Map();
  for (const rate of zoneHistory) {
    const key = `${String(rate.company)}:${rate.zone.toLocaleLowerCase()}`;
    if (!zoneRatesByCompanyZone.has(key)) zoneRatesByCompanyZone.set(key, []);
    zoneRatesByCompanyZone.get(key).push(rate);
  }
  return { companyByName, ratesByWorker, zoneRatesByCompanyZone };
}

export function getCompanyWorkerRates(worker, date, context) {
  const history = context.ratesByWorker.get(String(worker._id)) || [];
  const effectiveDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  let effective;
  for (const rate of history) {
    if (rate.applicableFrom > effectiveDate) break;
    effective = {
      applicableFrom: rate.applicableFrom,
      dailyRate: rate.labourDailyRate,
      overtimeRate: rate.labourOvertimeRate,
      companyDailyRate: rate.companyDailyRate,
      companyOvertimeRate: rate.companyOvertimeRate,
    };
  }
  for (const rate of worker.rateHistory || []) {
    const applicableFrom = new Date(rate.applicableFrom);
    if (applicableFrom > effectiveDate) continue;
    if (!effective || applicableFrom >= effective.applicableFrom) {
      effective = {
        applicableFrom,
        dailyRate: rate.dailyRate,
        overtimeRate: rate.overtimeRate,
        companyDailyRate: effective?.companyDailyRate,
        companyOvertimeRate: effective?.companyOvertimeRate,
      };
    }
  }
  const company = context.companyByName.get(worker.companyName);
  const zoneHistory =
    context.zoneRatesByCompanyZone?.get(
      `${String(company?._id)}:${String(worker.workZone || "").toLocaleLowerCase()}`,
    ) || [];
  let effectiveZoneRate;
  for (const rate of zoneHistory) {
    if (rate.applicableFrom > effectiveDate) break;
    effectiveZoneRate = rate;
  }
  return {
    companyDailyRate:
      effectiveZoneRate?.dailyRate ??
      effective?.companyDailyRate ??
      Number(company?.companyLabourRate || 0),
    companyOvertimeRate:
      effectiveZoneRate?.overtimeHourlyRate ??
      effective?.companyOvertimeRate ??
      0,
    dailyRate: effective
      ? Number(effective.dailyRate)
      : Number(
          worker.defaultDailyRate ||
            (worker.rateHistory?.length &&
            !worker.rateHistoryFallbackToZone
              ? 0
              : effectiveZoneRate?.labourDailyRate) ||
            0,
        ),
    overtimeRate: effective
      ? Number(effective.overtimeRate)
      : Number(
          worker.overtimeHourlyRate ||
            effectiveZoneRate?.labourOvertimeRate ||
            0,
        ),
  };
}

export function workerRateChangesAtDate(
  worker,
  date,
  dailyRate,
  overtimeRate,
  context,
) {
  const effective = getCompanyWorkerRates(worker, date, context);
  return (
    (dailyRate !== undefined &&
      Number(dailyRate) !== effective.dailyRate) ||
    (overtimeRate !== undefined &&
      Number(overtimeRate) !== effective.overtimeRate)
  );
}

export function getWorkerRateHistory(worker, companyRates = []) {
  const byDate = new Map();
  for (const rate of companyRates) {
    byDate.set(new Date(rate.applicableFrom).toISOString().slice(0, 10), {
      applicableFrom: rate.applicableFrom,
      dailyRate: rate.labourDailyRate,
      overtimeRate: rate.labourOvertimeRate,
    });
  }
  for (const rate of worker.rateHistory || []) {
    byDate.set(new Date(rate.applicableFrom).toISOString().slice(0, 10), {
      applicableFrom: rate.applicableFrom,
      dailyRate: rate.dailyRate,
      overtimeRate: rate.overtimeRate,
    });
  }
  return [...byDate.values()].sort(
    (left, right) =>
      new Date(left.applicableFrom).getTime() -
      new Date(right.applicableFrom).getTime(),
  );
}

export function upsertWorkerRateHistory(
  worker,
  applicableFrom,
  dailyRate,
  overtimeRate,
) {
  const date = new Date(applicableFrom);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Rate effective date is invalid.");
  }
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const existing = (worker.rateHistory || []).find(
    (rate) =>
      new Date(rate.applicableFrom).toISOString().slice(0, 10) ===
      day.toISOString().slice(0, 10),
  );
  if (existing) {
    existing.dailyRate = dailyRate;
    existing.overtimeRate = overtimeRate;
  } else {
    worker.rateHistory.push({
      applicableFrom: day,
      dailyRate,
      overtimeRate,
    });
  }
  worker.rateHistory.sort(
    (left, right) =>
      new Date(left.applicableFrom).getTime() -
      new Date(right.applicableFrom).getTime(),
  );
  return day;
}
