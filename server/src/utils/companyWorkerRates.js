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
  let effective;
  const effectiveDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  for (const rate of history) {
    if (rate.applicableFrom > effectiveDate) break;
    effective = rate;
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
    dailyRate:
      Number(
        effective?.labourDailyRate ||
          worker.defaultDailyRate ||
          effectiveZoneRate?.labourDailyRate ||
          0,
      ),
    overtimeRate:
      effective?.labourOvertimeRate ??
      Number(worker.overtimeHourlyRate || 0),
  };
}
