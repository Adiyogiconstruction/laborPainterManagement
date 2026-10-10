import { Router } from "express";
import mongoose from "mongoose";
import CompanyClient from "../models/CompanyClient.js";
import CompanyLabourAssignment from "../models/CompanyLabourAssignment.js";
import Worker from "../models/Worker.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { pick } from "../utils/serializers.js";
import { recordAdminActivity } from "../utils/adminActivity.js";

const router = Router();
const dayMs = 24 * 60 * 60 * 1000;
const editable = [
  "name",
  "location",
  "gstin",
  "contact",
  "email",
  "companyLabourRate",
  "originalLabourRate",
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
  for (const field of ["companyLabourRate", "originalLabourRate"]) {
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

const serializeCompany = (company, role) => {
  const data = company.toObject();
  if (role !== "OWNER") {
    delete data.companyLabourRate;
    delete data.originalLabourRate;
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

const periodDays = (start, end, rangeStart, rangeEnd) => {
  const overlapStart = Math.max(start.getTime(), rangeStart.getTime());
  const overlapEnd = Math.min(end.getTime(), rangeEnd.getTime());
  return overlapStart > overlapEnd
    ? 0
    : Math.floor((overlapEnd - overlapStart) / dayMs) + 1;
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter =
      req.query.includeInactive === "true" ? {} : { active: true };
    const companies = await CompanyClient.find(filter).sort({ name: 1 });
    res.json({
      companies: companies.map((company) =>
        serializeCompany(company, req.user.role),
      ),
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
    const companyFilter =
      req.query.includeInactive === "true" ? {} : { active: true };
    const companies = await CompanyClient.find(companyFilter)
      .select("name")
      .sort({ name: 1 });
    const assignments = await CompanyLabourAssignment.find({
      company: { $in: companies.map((company) => company._id) },
      startDate: { $lte: rangeEnd },
      endDate: { $gte: rangeStart },
    }).select("company companyName labourCount startDate endDate companyLabourRate originalLabourRate");

    const summaries = new Map(
      companies.map((company) => [
        String(company._id),
        { profit: 0, supplyCount: 0, labourDays: 0 },
      ]),
    );
    const lastSupplies = new Map();
    for (const assignment of assignments) {
      const days = periodDays(
        assignment.startDate,
        assignment.endDate,
        rangeStart,
        rangeEnd,
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
  "/:id/assignments",
  asyncHandler(async (req, res) => {
    const company = await CompanyClient.findById(req.params.id);
    if (!company) throw new ApiError(404, "Company/client not found.");
    const rangeStart = parseDateOnly(req.query.from, "From date");
    const rangeEnd = parseDateOnly(req.query.to, "To date");
    if (rangeStart > rangeEnd) {
      throw new ApiError(400, "From date must be on or before To date.");
    }
    const assignments = await CompanyLabourAssignment.find({
      company: company._id,
      startDate: { $lte: rangeEnd },
      endDate: { $gte: rangeStart },
    }).sort({ startDate: -1, createdAt: -1 });
    let labourDays = 0;
    let profit = 0;
    const records = assignments.map((assignment) => {
      const days = periodDays(
        assignment.startDate,
        assignment.endDate,
        rangeStart,
        rangeEnd,
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
    const startDate = parseDateOnly(req.body.startDate, "From date");
    const endDate = parseDateOnly(req.body.endDate, "To date");
    if (startDate > endDate) {
      throw new ApiError(400, "From date must be on or before To date.");
    }
    const assignment = await CompanyLabourAssignment.create({
      company: company._id,
      companyName: company.name,
      labourCount,
      startDate,
      endDate,
      companyLabourRate: company.companyLabourRate,
      originalLabourRate: company.originalLabourRate,
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
    if (req.body.endDate !== undefined) {
      assignment.endDate = parseDateOnly(req.body.endDate, "To date");
    }
    if (assignment.startDate > assignment.endDate) {
      throw new ApiError(400, "From date must be on or before To date.");
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
    const previousName = company.name;
    company.set(updates);
    await company.save();
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

export default router;
