import { Router } from "express";
import mongoose from "mongoose";
import CompanyClient from "../models/CompanyClient.js";
import CompanyLabourAssignment from "../models/CompanyLabourAssignment.js";
import Worker from "../models/Worker.js";
import Attendance from "../models/Attendance.js";
import CompanyWorkerRate from "../models/CompanyWorkerRate.js";
import CompanyZoneRate from "../models/CompanyZoneRate.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { pick } from "../utils/serializers.js";
import { recordAdminActivity } from "../utils/adminActivity.js";
import { getAssignmentDaysInRange } from "../utils/companyAssignmentUtils.js";

const router = Router();
const editable = [
  "name",
  "location",
  "gstin",
  "contact",
  "email",
  "companyLabourRate",
  "originalLabourRate",
  "zones",
  "active",
];

const normalize = (body) => {
  const data = pick(body, editable);
  if (data.name !== undefined) data.name = String(data.name).trim();
  if (data.location !== undefined) data.location = String(data.location).trim();
  if (data.gstin !== undefined) data.gstin = String(data.gstin).trim().toUpperCase();
  if (data.contact !== undefined) data.contact = String(data.contact).trim();
  if (data.email !== undefined) data.email = String(data.email).trim().toLowerCase();
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw new ApiError(400, "Enter a valid email address.");
  }
  if (data.zones !== undefined) {
    const zoneValues = Array.isArray(data.zones)
      ? data.zones
      : String(data.zones || "").split(/\r?\n/);
    data.zones = [
      ...new Map(
        zoneValues
          .map((zone) =>
            String(zone || "")
              .trim()
              .replace(/\b\w/g, (character) => character.toUpperCase()),
          )
          .filter(Boolean)
          .map((zone) => [zone.toLocaleLowerCase(), zone]),
      ).values(),
    ];
    if (data.zones.some((zone) => normalizeZoneKey(zone) === "unassigned")) {
      throw new ApiError(400, '"Unassigned" is reserved and cannot be a company zone.');
    }
    if (data.zones.some((zone) => zone.length > 100)) {
      throw new ApiError(400, "Zone names must be 100 characters or fewer.");
    }
  }
  for (const field of [
    "companyLabourRate",
    "originalLabourRate",
  ]) {
    if (data[field] !== undefined) {
      const rate = data[field] === "" || data[field] === null ? 0 : Number(data[field]);
      if (!Number.isFinite(rate) || rate < 0) {
        throw new ApiError(400, "Labour rates must be valid non-negative amounts.");
      }
      data[field] = rate;
    }
  }
  return data;
};

const serializeCompany = (
  company,
  role,
  zoneRates = [],
  zones = company.zones || [],
) => {
  const data = company.toObject();
  data.zones = zones;
  if (role !== "OWNER") {
    delete data.companyLabourRate;
    delete data.originalLabourRate;
  } else {
    data.zoneRates = zoneRates;
  }
  return data;
};

const assertUniqueName = async (name, excludeId) => {
  const query = { name };
  if (excludeId) query._id = { $ne: excludeId };
  const duplicate = await CompanyClient.findOne(query).collation({
    locale: "en",
    strength: 2,
  });
  if (duplicate) throw new ApiError(409, "Company/client name already exists.");
};

const parseDateOnly = (value, label) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${label} must be a valid date.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, `${label} must be a valid date.`);
  }
  return date;
};

const normalizeCompanyZoneRates = (body, zones = [], role) => {
  if (role !== "OWNER" || body.zoneRates === undefined) return null;
  if (!Array.isArray(body.zoneRates)) {
    throw new ApiError(400, "Zone rates must be provided as a list.");
  }
  if (zones.length === 0) {
    throw new ApiError(400, "Add at least one company zone.");
  }
  const zoneDate = parseDateOnly(body.applicableFrom, "Rates effective from");
  const configuredZones = new Set(zones.map(normalizeZoneKey));
  const seenZones = new Set();
  const rates = body.zoneRates
    .filter((rate) => String(rate.zone || "").trim())
    .map((rate) => {
      const zone = String(rate.zone).trim().replace(/\b\w/g, (c) => c.toUpperCase());
      const key = normalizeZoneKey(zone);
      if (!configuredZones.has(key)) {
        throw new ApiError(400, `Add ${zone} to the company zones before saving its rates.`);
      }
      if (seenZones.has(key)) {
        throw new ApiError(400, `Zone ${zone} can only be added once.`);
      }
      seenZones.add(key);
      if (
        String(rate.companyDailyRate ?? "").trim() === "" ||
        String(rate.labourDailyRate ?? "").trim() === ""
      ) {
        throw new ApiError(400, `Enter both rates for ${zone}.`);
      }
      const dailyRate = Number(rate.companyDailyRate);
      const labourDailyRate = Number(rate.labourDailyRate);
      if (
        !Number.isFinite(dailyRate) ||
        dailyRate < 0 ||
        !Number.isFinite(labourDailyRate) ||
        labourDailyRate < 0
      ) {
        throw new ApiError(400, `Enter valid company and labour rates for ${zone}.`);
      }
      return { zone, dailyRate, labourDailyRate };
    });
  if (rates.length !== configuredZones.size) {
    throw new ApiError(400, "Set company and labour rates for every configured zone.");
  }
  return { applicableFrom: zoneDate, rates };
};

const saveCompanyZoneRates = async (company, zoneRates, userId) => {
  if (!zoneRates?.rates.length) return;
  await Promise.all(
    zoneRates.rates.map(({ zone, dailyRate, labourDailyRate }) =>
      CompanyZoneRate.findOneAndUpdate(
        {
          company: company._id,
          zone,
          applicableFrom: zoneRates.applicableFrom,
        },
        {
          $set: { dailyRate, labourDailyRate },
          $setOnInsert: {
            company: company._id,
            zone,
            applicableFrom: zoneRates.applicableFrom,
            createdBy: userId,
          },
        },
        { upsert: true, runValidators: true },
      ),
    ),
  );
};

const getAssignmentRates = async (company, zone, startDate) => {
  const rates = await CompanyZoneRate.find({
    company: company._id,
    applicableFrom: { $lte: startDate },
  })
    .sort({ applicableFrom: -1 })
    .lean();
  const zoneRate = rates.find(
    (rate) => normalizeZoneKey(rate.zone) === normalizeZoneKey(zone),
  );
  return {
    companyLabourRate:
      zoneRate?.dailyRate ?? Number(company.companyLabourRate || 0),
    originalLabourRate:
      zoneRate?.labourDailyRate ?? Number(company.originalLabourRate || 0),
  };
};

const getEffectiveWorkerRate = (history, date, company, worker, zoneRate) => {
  let effective;
  const effectiveDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  for (const rate of history) {
    if (rate.applicableFrom > effectiveDate) break;
    effective = rate;
  }
  return {
    companyDailyRate:
      effective?.companyDailyRate ?? Number(company.companyLabourRate || 0),
    labourDailyRate:
      Number(
        effective?.labourDailyRate ||
          worker.defaultDailyRate ||
          zoneRate?.labourDailyRate ||
          0,
      ),
    labourOvertimeRate:
      effective?.labourOvertimeRate ??
      Number(worker.overtimeHourlyRate || 0),
  };
};

const getEffectiveZoneRateRecord = (history, date) => {
  const effectiveDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  let effective;
  for (const rate of history) {
    if (rate.applicableFrom > effectiveDate) break;
    effective = rate;
  }
  return effective || null;
};

const getEffectiveZoneRate = (history, date) =>
  getEffectiveZoneRateRecord(history, date)?.dailyRate ?? null;

const normalizeZoneKey = (zone) => String(zone || "").trim().toLocaleLowerCase();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter =
      req.query.includeInactive === "true" ? {} : { active: true };
    const companies = await CompanyClient.find(filter).sort({ name: 1 });
    const workerZones = companies.length
      ? await Worker.find({
          companyName: { $in: companies.map((company) => company.name) },
          deletedAt: null,
          type: "LABOUR",
        })
          .select("companyName workZone")
          .lean()
      : [];
    const zonesByCompany = new Map();
    for (const worker of workerZones) {
      if (!worker.workZone) continue;
      const key = worker.companyName;
      if (!zonesByCompany.has(key)) zonesByCompany.set(key, []);
      zonesByCompany.get(key).push(worker.workZone);
    }
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    );
    const rateHistory =
      req.user.role === "OWNER" && companies.length
        ? await CompanyZoneRate.find({
            company: { $in: companies.map((company) => company._id) },
            applicableFrom: { $lte: today },
          })
            .sort({ company: 1, zone: 1, applicableFrom: 1 })
            .lean()
        : [];
    const ratesByCompanyZone = new Map();
    for (const rate of rateHistory) {
      const key = `${String(rate.company)}:${normalizeZoneKey(rate.zone)}`;
      ratesByCompanyZone.set(key, rate);
    }
    res.json({
      companies: companies.map((company) => {
        const zones = [
          ...new Map(
            [...(company.zones || []), ...(zonesByCompany.get(company.name) || [])]
              .map((zone) => [normalizeZoneKey(zone), zone]),
          ).values(),
        ].sort((left, right) => left.localeCompare(right));
        const zoneRates = zones.map((zone) => {
          const rate = ratesByCompanyZone.get(
            `${String(company._id)}:${normalizeZoneKey(zone)}`,
          );
          return {
            zone,
            configured: Boolean(rate),
            dailyRate: rate?.dailyRate ?? Number(company.companyLabourRate || 0),
            labourDailyRate: rate?.labourDailyRate ?? 0,
          };
        });
        return serializeCompany(company, req.user.role, zoneRates, zones);
      }),
    });
  }),
);

router.get(
  "/profit-summary",
  allowRoles("OWNER"),
  asyncHandler(async (req, res) => {
    const rangeStart = parseDateOnly(req.query.from, "From date");
    const rangeEnd = parseDateOnly(req.query.to, "To date");
    if (rangeStart > rangeEnd) {
      throw new ApiError(400, "From date must be on or before To date.");
    }
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const companyFilter =
      req.query.includeInactive === "true" ? {} : { active: true };
    const companies = await CompanyClient.find(companyFilter)
      .select("name")
      .sort({ name: 1 });
    const assignments = await CompanyLabourAssignment.find({
      company: { $in: companies.map((company) => company._id) },
      startDate: { $lte: rangeEnd },
      ...(rangeStart <= today
        ? { $or: [{ endDate: { $gte: rangeStart } }, { endDate: null }] }
        : { endDate: { $gte: rangeStart } }),
    }).select("company companyName zone labourCount startDate endDate companyLabourRate originalLabourRate");

    const summaries = new Map(
      companies.map((company) => [
        String(company._id),
        { profit: 0, supplyCount: 0, labourDays: 0 },
      ]),
    );
    const lastSupplies = new Map();
    for (const assignment of assignments) {
      const days = getAssignmentDaysInRange(
        assignment,
        rangeStart,
        rangeEnd,
        today,
      );
      const profit =
        days *
        assignment.labourCount *
        (assignment.companyLabourRate - assignment.originalLabourRate);
      const key = String(assignment.company);
      const summary = summaries.get(key);
      summary.profit += profit;
      summary.supplyCount += 1;
      summary.labourDays += days * assignment.labourCount;
      const currentLastSupply = lastSupplies.get(key);
      if (
        !currentLastSupply ||
        assignment.startDate > currentLastSupply.startDate
      ) {
        lastSupplies.set(key, {
          labourCount: assignment.labourCount,
          zone: assignment.zone,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
        });
      }
    }
    const companyProfits = companies.map((company) => ({
      companyId: company.id,
      companyName: company.name,
      ...summaries.get(String(company._id)),
      lastSupply: lastSupplies.get(String(company._id)) || null,
    }));
    res.json({
      companies: companyProfits,
      totalProfit: companyProfits.reduce(
        (total, company) => total + company.profit,
        0,
      ),
    });
  }),
);

router.get(
  "/:id/overview",
  allowRoles("OWNER"),
  asyncHandler(async (req, res) => {
    const company = await CompanyClient.findById(req.params.id);
    if (!company) throw new ApiError(404, "Company/client not found.");
    const month = String(req.query.month || "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new ApiError(400, "Month must use YYYY-MM format.");
    }
    const [year, monthNumber] = month.split("-").map(Number);
    const rangeStart = new Date(year, monthNumber - 1, 1);
    const rangeEnd = new Date(year, monthNumber, 1);
    const ratesThroughDate = new Date(
      Date.UTC(year, monthNumber, 0, 23, 59, 59, 999),
    );
    const today = new Date();
    const todayUtcEnd = new Date(
      Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
        999,
      ),
    );
    const historyThroughDate =
      ratesThroughDate > todayUtcEnd ? ratesThroughDate : todayUtcEnd;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(10, Number.parseInt(req.query.pageSize, 10) || 10),
    );
    const workerFilter = {
      companyName: company.name,
      deletedAt: null,
      type: "LABOUR",
    };
    const [allWorkers, zones] = await Promise.all([
      Worker.find(workerFilter)
        .select("_id name workZone active companyName defaultDailyRate overtimeHourlyRate")
        .sort({ name: 1 })
        .lean(),
      Worker.distinct("workZone", {
        companyName: company.name,
        deletedAt: null,
        type: "LABOUR",
      }),
    ]);
    const zoneNames = [
      ...new Map(
        [...(company.zones || []), ...zones]
          .filter(Boolean)
          .map((zone) => [normalizeZoneKey(zone), zone]),
      ).values(),
    ].sort((left, right) => left.localeCompare(right));
    const zoneRateHistory = zoneNames.length
      ? await CompanyZoneRate.find({
          company: company._id,
          applicableFrom: { $lte: historyThroughDate },
        })
          .sort({ zone: 1, applicableFrom: 1 })
          .lean()
      : [];
    const zoneRatesByName = new Map();
    for (const rate of zoneRateHistory) {
      const key = normalizeZoneKey(rate.zone);
      if (!zoneRatesByName.has(key)) zoneRatesByName.set(key, []);
      zoneRatesByName.get(key).push(rate);
    }
    const currentWorkerIds = allWorkers.map((worker) => worker._id);
    const attendance = await Attendance.find({
      date: { $gte: rangeStart, $lt: rangeEnd },
      $or: [
        { company: company._id },
        { companyName: company.name },
        {
          company: { $exists: false },
          companyName: { $exists: false },
          worker: { $in: currentWorkerIds },
        },
        {
          company: null,
          companyName: "",
          worker: { $in: currentWorkerIds },
        },
      ],
    })
      .select("worker company companyName date status workUnits overtimeHours dailyRate overtimeRate payableAmount companyDailyRate workZone")
      .sort({ date: 1 })
      .lean();
    const attendanceWorkerIds = [
      ...new Set(attendance.map((record) => String(record.worker))),
    ];
    const historicalWorkers = attendanceWorkerIds.length
      ? await Worker.find({
          _id: { $in: attendanceWorkerIds },
          deletedAt: null,
          type: "LABOUR",
        })
          .select("_id name workZone active companyName defaultDailyRate overtimeHourlyRate")
          .lean()
      : [];
    const workerById = new Map(
      [...allWorkers, ...historicalWorkers].map((worker) => [
        String(worker._id),
        worker,
      ]),
    );
    const zoneMatches = (zone) =>
      !req.query.zone ||
      (req.query.zone === "Unassigned"
        ? !String(zone || "").trim()
        : normalizeZoneKey(zone) === normalizeZoneKey(req.query.zone));
    const includedWorkerIds = new Set(
      allWorkers
        .filter((worker) => zoneMatches(worker.workZone))
        .map((worker) => String(worker._id)),
    );
    for (const record of attendance) {
      const worker = workerById.get(String(record.worker));
      if (worker && zoneMatches(record.workZone || worker.workZone)) {
        includedWorkerIds.add(String(worker._id));
      }
    }
    const visibleWorkers = [...includedWorkerIds]
      .map((workerId) => workerById.get(workerId))
      .filter(Boolean)
      .sort((left, right) => left.name.localeCompare(right.name));
    const workersById = workerById;
    const workerIds = [...workerById.keys()];
    const rateHistory = workerIds.length
      ? await CompanyWorkerRate.find({
          company: company._id,
          worker: { $in: workerIds },
          applicableFrom: { $lte: historyThroughDate },
        })
          .sort({ worker: 1, applicableFrom: 1 })
          .lean()
      : [];
    const ratesByWorker = new Map();
    for (const rate of rateHistory) {
      const key = String(rate.worker);
      if (!ratesByWorker.has(key)) ratesByWorker.set(key, []);
      ratesByWorker.get(key).push(rate);
    }
    const statsByWorker = new Map(
      visibleWorkers.map((worker) => [
        String(worker._id),
        {
          attendanceEntries: 0,
          days: 0,
          overtimeHours: 0,
          companyBilling: 0,
          labourSalary: 0,
        },
      ]),
    );
    const zonesByWorker = new Map();
    for (const record of attendance) {
      const worker = workersById.get(String(record.worker));
      if (!worker) continue;
      if (!zoneMatches(record.workZone || worker.workZone)) continue;
      const stats = statsByWorker.get(String(record.worker));
      if (!stats) continue;
      const workUnits = Number(record.workUnits || 0);
      const overtimeHours = Number(record.overtimeHours || 0);
      const attendanceZone = record.workZone || worker.workZone;
      if (attendanceZone) {
        if (!zonesByWorker.has(String(record.worker))) {
          zonesByWorker.set(String(record.worker), new Set());
        }
        zonesByWorker.get(String(record.worker)).add(attendanceZone);
      }
      const zoneRate = getEffectiveZoneRateRecord(
        zoneRatesByName.get(normalizeZoneKey(attendanceZone)) || [],
        record.date,
      );
      const rates = getEffectiveWorkerRate(
        ratesByWorker.get(String(record.worker)) || [],
        record.date,
        company,
        worker,
        zoneRate,
      );
      stats.attendanceEntries += 1;
      if (workUnits > 0) stats.days += 1;
      stats.overtimeHours += overtimeHours;
      stats.companyBilling +=
        Number(
          record.companyDailyRate ?? zoneRate?.dailyRate ?? rates.companyDailyRate,
        ) *
        workUnits;
      stats.labourSalary += Number(
        record.payableAmount ??
          Number(record.dailyRate ?? rates.labourDailyRate) * workUnits +
            Number(record.overtimeRate ?? rates.labourOvertimeRate) *
              overtimeHours,
      );
    }
    const totals = [...statsByWorker.values()].reduce(
      (result, stats) => ({
        attendanceEntries: result.attendanceEntries + stats.attendanceEntries,
        days: result.days + stats.days,
        overtimeHours: result.overtimeHours + stats.overtimeHours,
        companyBilling: result.companyBilling + stats.companyBilling,
        labourSalary: result.labourSalary + stats.labourSalary,
      }),
      {
        attendanceEntries: 0,
        days: 0,
        overtimeHours: 0,
        companyBilling: 0,
        labourSalary: 0,
      },
    );
    const workers = visibleWorkers
      .slice((page - 1) * pageSize, page * pageSize)
      .map((worker) => ({
        id: worker._id,
        name: worker.name,
        zone:
          [...(zonesByWorker.get(String(worker._id)) || [])].join(", ") ||
          worker.workZone ||
          "Unassigned",
        active: worker.active,
        ...statsByWorker.get(String(worker._id)),
        rates: {
          ...getEffectiveWorkerRate(
            ratesByWorker.get(String(worker._id)) || [],
            today,
            company,
            worker,
            getEffectiveZoneRateRecord(
              zoneRatesByName.get(normalizeZoneKey(worker.workZone)) || [],
              today,
            ),
          ),
          companyDailyRate:
            getEffectiveZoneRate(
              zoneRatesByName.get(normalizeZoneKey(worker.workZone)) || [],
              today,
            ) ??
            getEffectiveWorkerRate(
              ratesByWorker.get(String(worker._id)) || [],
              today,
              company,
              worker,
            ).companyDailyRate,
        },
      }));
    const margin = totals.companyBilling - totals.labourSalary;
    res.json({
      company: {
        id: company._id,
        name: company.name,
        companyLabourRate: company.companyLabourRate || 0,
        zones: zoneNames,
        zoneRates: zoneNames.map((zone) => {
          const effective = getEffectiveZoneRateRecord(
            zoneRatesByName.get(normalizeZoneKey(zone)) || [],
            today,
          );
          return {
            zone,
            dailyRate:
              effective?.dailyRate ?? Number(company.companyLabourRate || 0),
            labourDailyRate: effective?.labourDailyRate ?? 0,
            configured: Boolean(effective),
          };
        }),
      },
      month,
      zone: String(req.query.zone || ""),
      zones: [...new Set([
        ...zoneNames,
        ...zones.map((zone) => zone || "Unassigned"),
        ...attendance.map((record) => record.workZone || "Unassigned"),
      ])].sort(
        (left, right) => left.localeCompare(right),
      ),
      totals: { ...totals, margin },
      workers,
      pagination: {
        page,
        pageSize,
        total: visibleWorkers.length,
        pages: Math.max(1, Math.ceil(visibleWorkers.length / pageSize)),
      },
    });
  }),
);

router.patch(
  "/:id/workers/:workerId/rates",
  allowRoles("OWNER"),
  asyncHandler(async (req, res) => {
    const company = await CompanyClient.findById(req.params.id);
    if (!company) throw new ApiError(404, "Company/client not found.");
    const worker = await Worker.findOne({
      _id: req.params.workerId,
      companyName: company.name,
      deletedAt: null,
      type: "LABOUR",
    });
    if (!worker) throw new ApiError(404, "Labour does not belong to this company.");
    const applicableFrom = parseDateOnly(
      req.body.applicableFrom,
      "Applicable from date",
    );
    const rateFields = [
      "labourDailyRate",
      "labourOvertimeRate",
    ];
    const rates = {};
    for (const field of rateFields) {
      const value = Number(req.body[field]);
      if (!Number.isFinite(value) || value < 0) {
        throw new ApiError(400, "All rates must be valid non-negative amounts.");
      }
      rates[field] = value;
    }
    if (req.body.companyDailyRate !== undefined) {
      const value = Number(req.body.companyDailyRate);
      if (!Number.isFinite(value) || value < 0) {
        throw new ApiError(400, "Company rate must be a valid non-negative amount.");
      }
      rates.companyDailyRate = value;
    }
    const rate = await CompanyWorkerRate.findOneAndUpdate(
      { company: company._id, worker: worker._id, applicableFrom },
      {
        $set: rates,
        $setOnInsert: {
          company: company._id,
          worker: worker._id,
          applicableFrom,
          createdBy: req.user.id,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    if (applicableFrom <= todayUtc) {
      const currentRate = await CompanyWorkerRate.findOne({
        company: company._id,
        worker: worker._id,
        applicableFrom: { $lte: todayUtc },
      })
        .sort({ applicableFrom: -1 })
        .lean();
      if (currentRate) {
        await Worker.updateOne(
          { _id: worker._id },
          {
            $set: {
              defaultDailyRate: currentRate.labourDailyRate,
              overtimeHourlyRate: currentRate.labourOvertimeRate,
            },
          },
        );
      }
    }
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} updated labour rates for ${worker.name} at ${company.name}.`,
      {
        companyId: company.id,
        workerId: worker.id,
        applicableFrom: req.body.applicableFrom,
        section: "companies",
      },
    );
    res.json({ rate });
  }),
);

router.get(
  "/:id/assignments",
  asyncHandler(async (req, res) => {
    const company = await CompanyClient.findById(req.params.id);
    if (!company) throw new ApiError(404, "Company/client not found.");
    const rangeStart = parseDateOnly(req.query.from, "From date");
    const rangeEnd = parseDateOnly(req.query.to, "To date");
    if (rangeStart > rangeEnd) {
      throw new ApiError(400, "From date must be on or before To date.");
    }
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const assignments = await CompanyLabourAssignment.find({
      company: company._id,
      startDate: { $lte: rangeEnd },
      ...(rangeStart <= today
        ? { $or: [{ endDate: { $gte: rangeStart } }, { endDate: null }] }
        : { endDate: { $gte: rangeStart } }),
    }).sort({ startDate: -1, createdAt: -1 });
    let labourDays = 0;
    let profit = 0;
    const records = assignments.map((assignment) => {
      const days = getAssignmentDaysInRange(
        assignment,
        rangeStart,
        rangeEnd,
        today,
      );
      const assignedLabourDays = days * assignment.labourCount;
      labourDays += assignedLabourDays;
      const assignmentProfit =
        assignedLabourDays *
        (assignment.companyLabourRate - assignment.originalLabourRate);
      if (req.user.role === "OWNER") profit += assignmentProfit;
      const data = assignment.toObject();
      data.periodDays = days;
      data.labourDays = assignedLabourDays;
      if (req.user.role === "OWNER") {
        data.profit = assignmentProfit;
      } else {
        delete data.companyLabourRate;
        delete data.originalLabourRate;
      }
      return data;
    });
    res.json({
      assignments: records,
      summary: {
        labourDays,
        ...(req.user.role === "OWNER" ? { profit } : {}),
      },
    });
  }),
);

router.post(
  "/:id/assignments",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const company = await CompanyClient.findById(req.params.id);
    if (!company) throw new ApiError(404, "Company/client not found.");
    const labourCount = Number(req.body.labourCount);
    if (!Number.isInteger(labourCount) || labourCount < 1) {
      throw new ApiError(400, "Labour count must be a positive whole number.");
    }
    const zone = String(req.body.zone || "").trim();
    if (!zone) throw new ApiError(400, "Zone is required.");
    const startDate = parseDateOnly(req.body.startDate, "From date");
    const endDate =
      req.body.ongoing || !req.body.endDate
        ? null
        : parseDateOnly(req.body.endDate, "To date");
    if (endDate && startDate > endDate) {
      throw new ApiError(400, "From date must be on or before To date.");
    }
    const rates = await getAssignmentRates(company, zone, startDate);
    const assignment = await CompanyLabourAssignment.create({
      company: company._id,
      companyName: company.name,
      zone,
      labourCount,
      startDate,
      endDate,
      ...rates,
      createdBy: req.user.id,
    });
    await recordAdminActivity(
      req,
      "CREATE",
      `${req.user.name} recorded ${labourCount} labour for ${company.name}.`,
      { companyId: company.id, assignmentId: assignment.id, section: "companies" },
    );
    const assignmentData = assignment.toObject();
    if (req.user.role !== "OWNER") {
      delete assignmentData.companyLabourRate;
      delete assignmentData.originalLabourRate;
    }
    res.status(201).json({ assignment: assignmentData });
  }),
);

router.patch(
  "/:id/assignments/:assignmentId",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(req.params.assignmentId)
    ) {
      throw new ApiError(404, "Labour record not found.");
    }
    const company = await CompanyClient.findById(req.params.id);
    if (!company) throw new ApiError(404, "Company/client not found.");
    const assignment = await CompanyLabourAssignment.findOne({
      _id: req.params.assignmentId,
      company: company._id,
    });
    if (!assignment) throw new ApiError(404, "Labour record not found.");
    const previousZone = assignment.zone;
    const previousStartDate = assignment.startDate.getTime();
    if (req.body.labourCount !== undefined) {
      const labourCount = Number(req.body.labourCount);
      if (!Number.isInteger(labourCount) || labourCount < 1) {
        throw new ApiError(400, "Labour count must be a positive whole number.");
      }
      assignment.labourCount = labourCount;
    }
    if (req.body.startDate !== undefined) {
      assignment.startDate = parseDateOnly(req.body.startDate, "From date");
    }
    if (req.body.zone !== undefined && String(req.body.zone).trim()) {
      assignment.zone = String(req.body.zone).trim();
    }
    if (req.body.ongoing === true) {
      assignment.endDate = null;
    } else if (req.body.endDate !== undefined && req.body.endDate !== "") {
      assignment.endDate = parseDateOnly(req.body.endDate, "To date");
    } else if (req.body.ongoing === false && !assignment.endDate) {
      throw new ApiError(400, "Enter the actual end date to finish this supply.");
    }
    if (assignment.endDate && assignment.startDate > assignment.endDate) {
      throw new ApiError(400, "From date must be on or before To date.");
    }
    if (
      assignment.zone !== previousZone ||
      assignment.startDate.getTime() !== previousStartDate
    ) {
      assignment.set(
        await getAssignmentRates(company, assignment.zone, assignment.startDate),
      );
    }
    await assignment.save();
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} updated a labour record for ${company.name}.`,
      { companyId: company.id, assignmentId: assignment.id, section: "companies" },
    );
    const data = assignment.toObject();
    if (req.user.role !== "OWNER") {
      delete data.companyLabourRate;
      delete data.originalLabourRate;
    }
    res.json({ assignment: data });
  }),
);

router.delete(
  "/:id/assignments/:assignmentId",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(req.params.assignmentId)
    ) {
      throw new ApiError(404, "Labour record not found.");
    }
    const company = await CompanyClient.findById(req.params.id);
    if (!company) throw new ApiError(404, "Company/client not found.");
    const assignment = await CompanyLabourAssignment.findOneAndDelete({
      _id: req.params.assignmentId,
      company: company._id,
    });
    if (!assignment) throw new ApiError(404, "Labour record not found.");
    await recordAdminActivity(
      req,
      "DELETE",
      `${req.user.name} permanently deleted a labour record for ${company.name}.`,
      { companyId: company.id, assignmentId: assignment.id, section: "companies" },
    );
    res.json({ message: "Labour record permanently deleted." });
  }),
);

router.post(
  "/",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = normalize(req.body);
    const zoneRates = normalizeCompanyZoneRates(
      req.body,
      data.zones || [],
      req.user.role,
    );
    if (req.user.role !== "OWNER") {
      delete data.companyLabourRate;
      delete data.originalLabourRate;
    }
    if (!data.name) throw new ApiError(400, "Company/client name is required.");
    await assertUniqueName(data.name);
    const company = await CompanyClient.create({
      ...data,
      createdBy: req.user.id,
    });
    await saveCompanyZoneRates(company, zoneRates, req.user.id);
    await recordAdminActivity(
      req,
      "CREATE",
      `${req.user.name} created company/client ${company.name}.`,
      { companyId: company.id, section: "companies" },
    );
    res.status(201).json({ company: serializeCompany(company, req.user.role) });
  }),
);

router.patch(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const company = await CompanyClient.findById(req.params.id);
    if (!company) throw new ApiError(404, "Company/client not found.");
    const updates = normalize(req.body);
    const zoneRates = normalizeCompanyZoneRates(
      req.body,
      updates.zones ?? company.zones ?? [],
      req.user.role,
    );
    if (req.user.role !== "OWNER") {
      delete updates.companyLabourRate;
      delete updates.originalLabourRate;
    }
    if (updates.name !== undefined) {
      if (!updates.name) {
        throw new ApiError(400, "Company/client name is required.");
      }
      await assertUniqueName(updates.name, company._id);
    }
    if (updates.active === false && company.active) {
      const assignedWorkers = await Worker.countDocuments({
        companyName: company.name,
      });
      if (assignedWorkers) {
        throw new ApiError(
          409,
          "This company is assigned to workers. Reassign them before deactivating it.",
        );
      }
    }
    if (updates.zones !== undefined) {
      const removedWorkers = await Worker.countDocuments({
        companyName: company.name,
        workZone: { $nin: updates.zones },
        deletedAt: null,
      });
      if (removedWorkers) {
        throw new ApiError(
          409,
          "Reassign workers from removed zones before saving the company zones.",
        );
      }
    }
    const previousName = company.name;
    company.set(updates);
    await company.save();
    await saveCompanyZoneRates(company, zoneRates, req.user.id);
    if (previousName !== company.name) {
      await Worker.updateMany(
        { companyName: previousName },
        { $set: { companyName: company.name } },
      );
    }
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} updated company/client ${company.name}.`,
      { companyId: company.id, section: "companies" },
    );
    res.json({ company: serializeCompany(company, req.user.role) });
  }),
);

router.delete(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const company = await CompanyClient.findById(req.params.id);
    if (!company) throw new ApiError(404, "Company/client not found.");
    const assignedWorkers = await Worker.countDocuments({
      companyName: company.name,
    });
    if (assignedWorkers) {
      throw new ApiError(
        409,
        "This company is assigned to workers. Reassign them before deactivating it.",
      );
    }
    company.active = false;
    await company.save();
    await recordAdminActivity(
      req,
      "DELETE",
      `${req.user.name} deactivated company/client ${company.name}.`,
      { companyId: company.id, section: "companies" },
    );
    res.json({ company: serializeCompany(company, req.user.role) });
  }),
);

router.delete(
  "/:id/permanent",
  allowRoles("OWNER"),
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new ApiError(404, "Company/client not found.");
    }
    const company = await CompanyClient.findById(req.params.id);
    if (!company) throw new ApiError(404, "Company/client not found.");
    if (company.active) {
      throw new ApiError(409, "Deactivate this company before permanently deleting it.");
    }
    const assignedWorkers = await Worker.countDocuments({
      companyName: company.name,
    });
    if (assignedWorkers) {
      throw new ApiError(
        409,
        "Reassign all workers from this company before permanently deleting it.",
      );
    }

    await recordAdminActivity(
      req,
      "DELETE",
      `${req.user.name} permanently deleted company/client ${company.name} and its rate and labour supply history.`,
      { companyId: company.id, companyName: company.name, section: "companies", permanent: true },
    );
    await Promise.all([
      CompanyWorkerRate.deleteMany({ company: company._id }),
      CompanyZoneRate.deleteMany({ company: company._id }),
      CompanyLabourAssignment.deleteMany({ company: company._id }),
    ]);
    await CompanyClient.deleteOne({ _id: company._id, active: false });
    res.json({ message: "Company/client and its history permanently deleted." });
  }),
);

export default router;
