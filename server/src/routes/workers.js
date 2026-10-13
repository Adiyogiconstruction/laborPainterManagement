import { Router } from "express";
import Worker from "../models/Worker.js";
import Payment from "../models/Payment.js";
import Attendance from "../models/Attendance.js";
import CompanyClient from "../models/CompanyClient.js";
import CompanyWorkerRate from "../models/CompanyWorkerRate.js";
import {
  getCompanyWorkerRates,
  loadCompanyWorkerRateHistory,
  upsertWorkerRateHistory,
  workerRateChangesAtDate,
} from "../utils/companyWorkerRates.js";
import {
  recalculateAttendanceForWorkerRate,
} from "../utils/workerRateHistory.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { pick } from "../utils/serializers.js";
import { recordAdminActivity } from "../utils/adminActivity.js";
import { parseWorkerSearch } from "../utils/workerSearch.js";
import { appendWorkerStatusTransition } from "../utils/workerStatusHistory.js";
import {
  applyWorkerStatusFilter,
  getWorkerLabourStatus,
  workerStatuses,
} from "../utils/workerStatus.js";
import { parseLocalDateOnly } from "../utils/localDateRange.js";
import multer from "multer";
import {
  authenticatedImageUrl,
  deleteImage,
  optimizedImageUrl,
  uploadImage,
} from "../services/cloudinary.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/"));
  },
});
const aadhaarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/"));
  },
});
const editable = [
  "type",
  "name",
  "companyName",
  "teamName",
  "phone",
  "aadhaarNumber",
  "address",
  "skill",
  "workZone",
  "ppeKitIssuedOn",
  "defaultDailyRate",
  "overtimeHourlyRate",
  "joiningDate",
  "active",
  "labourStatus",
  "notes",
];

const normalizeWorkerText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const normalizeWorkerFields = (data) => {
  for (const field of [
    "name",
    "companyName",
    "teamName",
    "workZone",
    "skill",
    "address",
  ]) {
    if (data[field] !== undefined)
      data[field] = normalizeWorkerText(data[field]);
  }
  return data;
};

const parseRateApplicableFrom = (value, fallback) => {
  const dateValue = value || fallback;
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new ApiError(400, "Rate effective date must use YYYY-MM-DD format.");
  }
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateValue
  ) {
    throw new ApiError(400, "Rate effective date is invalid.");
  }
  return date;
};

const syncWorkerSalaryRate = async (
  worker,
  applicableFrom,
  userId,
  dailyRate,
  overtimeRate,
) => {
  if (worker.companyName) {
    const company = await CompanyClient.findOne({ name: worker.companyName })
      .select("_id companyLabourRate")
      .lean();
    if (company) {
      const existingRate = await CompanyWorkerRate.findOne({
        company: company._id,
        worker: worker._id,
        applicableFrom: { $lte: applicableFrom },
      })
        .sort({ applicableFrom: -1 })
        .lean();
      await CompanyWorkerRate.updateOne(
        { company: company._id, worker: worker._id, applicableFrom },
        {
          $set: {
            companyDailyRate:
              existingRate?.companyDailyRate ?? company.companyLabourRate ?? 0,
            labourDailyRate: dailyRate,
            labourOvertimeRate: overtimeRate,
          },
          $setOnInsert: {
            company: company._id,
            worker: worker._id,
            applicableFrom,
            createdBy: userId,
          },
        },
        { upsert: true, runValidators: true },
      );
    }
  }
  await recalculateAttendanceForWorkerRate(worker, applicableFrom, userId);
};

const validateCompanyZone = async (companyName, workZone) => {
  if (!companyName || !workZone) return;
  const company = await CompanyClient.findOne({ name: companyName })
    .select("zones")
    .lean();
  if (
    company?.zones?.length &&
    !company.zones.some(
      (zone) => zone.toLocaleLowerCase() === workZone.toLocaleLowerCase(),
    )
  ) {
    throw new ApiError(
      400,
      "Select a work zone configured for the selected company.",
    );
  }
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = { deletedAt: null };
    const requestedType = req.query.type || "LABOUR";
    filter.type = requestedType;
    if (req.query.active !== undefined)
      filter.active = req.query.active === "true";
    if (req.query.search) {
      const { status, remaining } = parseWorkerSearch(req.query.search);

      if (status !== undefined) {
        if (!applyWorkerStatusFilter(filter, status, "ALL")) {
          throw new ApiError(400, "Choose a valid labour status.");
        }
      }

      if (remaining) {
        const escapedSearch = remaining.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const search = new RegExp(escapedSearch.slice(0, 80), "i");
        filter.$or = [
          { name: search },
          { companyName: search },
          { teamName: search },
          { workZone: search },
        ];
      }
    }
    const workers = await Worker.find(filter).sort({ active: -1, name: 1 });
    const workerIds = workers.map((worker) => worker._id);
    const [payableRows, paidRows] = await Promise.all([
      Attendance.aggregate([
        { $match: { worker: { $in: workerIds } } },
        {
          $group: { _id: "$worker", totalPayable: { $sum: "$payableAmount" } },
        },
      ]),
      Payment.aggregate([
        {
          $match: {
            worker: { $in: workerIds },
            deletedAt: null,
          },
        },
        {
          $group: {
            _id: "$worker",
            totalPaid: {
              $sum: {
                $cond: [{ $eq: ["$flow", "OUTFLOW"] }, "$amount", 0],
              },
            },
            totalReturned: {
              $sum: {
                $cond: [{ $eq: ["$flow", "INFLOW"] }, "$amount", 0],
              },
            },
            lastPaymentOn: { $max: "$paidOn" },
          },
        },
      ]),
    ]);
    const payableByWorker = new Map(
      payableRows.map((row) => [
        String(row._id),
        Number(row.totalPayable || 0),
      ]),
    );
    const paidByWorker = new Map(
      paidRows.map((row) => [
        String(row._id),
        {
          totalPaid: Number(row.totalPaid || 0),
          totalReturned: Number(row.totalReturned || 0),
          lastPaymentOn: row.lastPaymentOn,
        },
      ]),
    );
    const today = new Date();
    const rateContext = await loadCompanyWorkerRateHistory(workers, today);
    res.json({
      workers: workers.map((worker) => {
        const totalPayable = payableByWorker.get(String(worker._id)) || 0;
        const paymentTotals = paidByWorker.get(String(worker._id)) || {};
        const totalPaid = paymentTotals.totalPaid || 0;
        const totalReturned = paymentTotals.totalReturned || 0;
        const netPaid = totalPaid - totalReturned;
        const workerData = worker.toObject();
        if (workerData.aadhaarFrontPublicId)
          workerData.aadhaarFrontPath = authenticatedImageUrl(
            workerData.aadhaarFrontPublicId,
          );
        if (workerData.aadhaarBackPublicId)
          workerData.aadhaarBackPath = authenticatedImageUrl(
            workerData.aadhaarBackPublicId,
          );
        const rates = getCompanyWorkerRates(worker, today, rateContext);
        return {
          ...workerData,
          defaultDailyRate: rates.dailyRate,
          overtimeHourlyRate: rates.overtimeRate,
          totalPayable,
          totalPaid,
          totalReturned,
          netPaid,
          lastPaymentOn: paymentTotals.lastPaymentOn || null,
          totalDue: Math.max(0, totalPayable - netPaid),
          overpaid: Math.max(0, netPaid - totalPayable),
        };
      }),
    });
  }),
);

router.post(
  "/:id/photo",
  allowRoles("OWNER", "ADMIN"),
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "Please select an image file.");
    const worker = await Worker.findById(req.params.id);
    if (!worker) throw new ApiError(404, "Worker not found.");
    const uploaded = await uploadImage(req.file.buffer, "workledger/workers");
    const oldPublicId = worker.photoPublicId;
    worker.photoUrl = optimizedImageUrl(uploaded.public_id);
    worker.photoPath = worker.photoUrl;
    worker.photoPublicId = uploaded.public_id;
    await worker.save();
    await deleteImage(oldPublicId);
    res.json({
      worker,
      photoUrl: worker.photoUrl,
    });
  }),
);

router.post(
  "/:id/aadhaar",
  allowRoles("OWNER", "ADMIN"),
  aadhaarUpload.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const frontFile = req.files?.aadhaarFront?.[0];
    const backFile = req.files?.aadhaarBack?.[0];
    if (!frontFile || !backFile) {
      throw new ApiError(400, "Aadhaar front and back images are required.");
    }
    const worker = await Worker.findById(req.params.id);
    if (!worker) throw new ApiError(404, "Worker not found.");
    const [frontUploaded, backUploaded] = await Promise.all([
      uploadImage(frontFile.buffer, "workledger/aadhaar", {
        type: "authenticated",
      }),
      uploadImage(backFile.buffer, "workledger/aadhaar", {
        type: "authenticated",
      }),
    ]);
    const oldPublicIds = [
      worker.aadhaarFrontPublicId,
      worker.aadhaarBackPublicId,
    ];
    worker.aadhaarFrontUrl = frontUploaded.secure_url;
    worker.aadhaarBackUrl = backUploaded.secure_url;
    worker.aadhaarFrontPath = authenticatedImageUrl(frontUploaded.public_id);
    worker.aadhaarBackPath = authenticatedImageUrl(backUploaded.public_id);
    worker.aadhaarFrontPublicId = frontUploaded.public_id;
    worker.aadhaarBackPublicId = backUploaded.public_id;
    await worker.save();
    await Promise.all(oldPublicIds.map((publicId) => deleteImage(publicId)));
    res.json({ worker });
  }),
);

router.post(
  "/",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = normalizeWorkerFields({
      ...pick(req.body, editable),
      type: "LABOUR",
    });
    if (
      data.labourStatus !== undefined &&
      !workerStatuses.includes(data.labourStatus)
    ) {
      throw new ApiError(400, "Choose a valid labour status.");
    }
    data.labourStatus ||=
      data.active === false ? "INACTIVE" : "ACTIVE";
    data.active = data.labourStatus === "ACTIVE";
    if (!data.type || !String(data.name || "").trim() || !String(data.workZone || "").trim()) {
      throw new ApiError(400, "Name and work zone are required.");
    }
    await validateCompanyZone(data.companyName, data.workZone);
    const worker = new Worker(data);
    const dailyRate = Number(worker.defaultDailyRate || 0);
    const overtimeRate = Number(worker.overtimeHourlyRate || 0);
    worker.defaultDailyRate = 0;
    worker.overtimeHourlyRate = 0;
    const rateApplicableFrom = parseRateApplicableFrom(
      req.body.rateApplicableFrom,
      data.joiningDate
        ? String(data.joiningDate).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    upsertWorkerRateHistory(
      worker,
      rateApplicableFrom,
      dailyRate,
      overtimeRate,
    );
    worker.statusHistory = [
      {
        active: worker.active,
        labourStatus: worker.labourStatus,
        changedAt: worker.joiningDate,
      },
    ];
    await worker.save();
    await syncWorkerSalaryRate(
      worker,
      rateApplicableFrom,
      req.user.id,
      dailyRate,
      overtimeRate,
    );
    await recordAdminActivity(
      req,
      "CREATE",
      `${req.user.name} created worker profile for ${worker.name}.`,
      { workerId: worker.id, section: "workers" },
    );
    res.status(201).json({ worker });
  }),
);

router.patch(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await Worker.findById(req.params.id);
    if (!existing) throw new ApiError(404, "Worker not found.");
    const data = {
      ...existing.toObject(),
      ...normalizeWorkerFields(pick(req.body, editable)),
      type: "LABOUR",
    };
    if (!data.type || !String(data.name || "").trim() || !String(data.workZone || "").trim()) {
      throw new ApiError(400, "Name and work zone are required.");
    }
    const updates = normalizeWorkerFields(pick(req.body, editable));
    if (
      updates.labourStatus !== undefined &&
      !workerStatuses.includes(updates.labourStatus)
    ) {
      throw new ApiError(400, "Choose a valid labour status.");
    }
    if (updates.labourStatus) {
      updates.active = updates.labourStatus === "ACTIVE";
    } else if (updates.active !== undefined) {
      updates.labourStatus = updates.active ? "ACTIVE" : "INACTIVE";
    }
    const hasRateInput =
      updates.defaultDailyRate !== undefined ||
      updates.overtimeHourlyRate !== undefined;
    const rateApplicableFrom = hasRateInput
      ? parseRateApplicableFrom(
          req.body.rateApplicableFrom,
          new Date().toISOString().slice(0, 10),
        )
      : null;
    const rateContext = hasRateInput
      ? await loadCompanyWorkerRateHistory([existing], rateApplicableFrom)
      : null;
    const currentRates = rateContext
      ? getCompanyWorkerRates(existing, rateApplicableFrom, rateContext)
      : null;
    const dailyRate = Number(
      updates.defaultDailyRate ?? currentRates?.dailyRate ?? 0,
    );
    const overtimeRate = Number(
      updates.overtimeHourlyRate ?? currentRates?.overtimeRate ?? 0,
    );
    if (
      hasRateInput &&
      (!Number.isFinite(dailyRate) ||
        dailyRate < 0 ||
        !Number.isFinite(overtimeRate) ||
        overtimeRate < 0)
    ) {
      throw new ApiError(400, "Rates must be valid non-negative amounts.");
    }
    const rateChanged =
      hasRateInput &&
      workerRateChangesAtDate(
        existing,
        rateApplicableFrom,
        updates.defaultDailyRate,
        updates.overtimeHourlyRate,
        rateContext,
      );
    if (rateChanged) {
      if (!existing.rateHistory?.length) {
        existing.rateHistoryFallbackToZone =
          Number(existing.defaultDailyRate || 0) === 0;
      }
      delete updates.defaultDailyRate;
      delete updates.overtimeHourlyRate;
    }
    await validateCompanyZone(
      updates.companyName ?? existing.companyName,
      updates.workZone ?? existing.workZone,
    );
    const previousStatus = getWorkerLabourStatus(existing);
    existing.set({ ...updates, type: "LABOUR" });
    existing.labourStatus = updates.labourStatus || previousStatus;
    existing.active = existing.labourStatus === "ACTIVE";
    if (rateChanged) {
      upsertWorkerRateHistory(
        existing,
        rateApplicableFrom,
        dailyRate,
        overtimeRate,
      );
    }
    const nextStatus = getWorkerLabourStatus(existing);
    if (nextStatus !== previousStatus) {
      existing.statusHistory = appendWorkerStatusTransition(
        existing.statusHistory,
        previousStatus,
        nextStatus,
      );
    }
    const worker = await existing.save();
    if (rateChanged) {
      await syncWorkerSalaryRate(
        worker,
        rateApplicableFrom,
        req.user.id,
        dailyRate,
        overtimeRate,
      );
    }
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} updated worker profile for ${worker.name}${nextStatus !== previousStatus ? ` and changed status to ${nextStatus.replaceAll("_", " ").toLowerCase()}` : ""}.`,
      { workerId: worker.id, section: "workers" },
    );
    res.json({ worker });
  }),
);

router.get(
  "/deleted",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (_req, res) => {
    const workers = await Worker.find({ deletedAt: { $ne: null } })
      .sort({ deletedAt: -1, updatedAt: -1 })
      .limit(200);
    res.json({ workers });
  }),
);

router.patch(
  "/:id/restore",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const worker = await Worker.findById(req.params.id);
    if (!worker) throw new ApiError(404, "Worker not found.");
    if (!worker.deletedAt) {
      throw new ApiError(400, "This worker is not deleted.");
    }
    worker.deletedAt = null;
    worker.deletedBy = null;
    await worker.save();
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} restored worker profile for ${worker.name}.`,
      { workerId: worker.id, section: "workers", restored: true },
    );
    res.json({ worker });
  }),
);

router.delete(
  "/:id/permanent",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const worker = await Worker.findById(req.params.id);
    if (!worker) throw new ApiError(404, "Worker not found.");
    if (!worker.deletedAt) {
      throw new ApiError(
        400,
        "This worker is not deleted and cannot be permanently removed.",
      );
    }
    await Worker.findByIdAndDelete(req.params.id);
    await recordAdminActivity(
      req,
      "DELETE",
      `${req.user.name} permanently deleted worker profile for ${worker.name}.`,
      { workerId: worker.id, section: "workers", permanent: true },
    );
    res.json({ deletedId: worker.id });
  }),
);

router.delete(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const worker = await Worker.findById(req.params.id);
    if (!worker) throw new ApiError(404, "Worker not found.");
    if (worker.deletedAt) {
      throw new ApiError(
        400,
        "This worker is already deleted and is in the recycle bin.",
      );
    }
    worker.deletedAt = new Date();
    worker.deletedBy = req.user.id;
    await worker.save();
    await recordAdminActivity(
      req,
      "DELETE",
      `${req.user.name} moved worker profile for ${worker.name} to recycle bin.`,
      { workerId: worker.id, section: "workers" },
    );
    res.json({ deletedId: worker.id });
  }),
);

router.get(
  "/:id/registration",
  asyncHandler(async (req, res) => {
    const worker = await Worker.findOne({
      _id: req.params.id,
      deletedAt: null,
    });
    if (!worker) throw new ApiError(404, "Labour record not found.");

    const workerData = worker.toObject();
    const registrationWorker = pick(workerData, [
      "_id",
      "name",
      "companyName",
      "teamName",
      "phone",
      "aadhaarNumber",
      "address",
      "skill",
      "workZone",
      "photoPath",
      "photoUrl",
      "aadhaarFrontPath",
      "aadhaarBackPath",
      "ppeKitIssuedOn",
      "joiningDate",
    ]);
    if (workerData.aadhaarFrontPublicId) {
      registrationWorker.aadhaarFrontPath = authenticatedImageUrl(
        workerData.aadhaarFrontPublicId,
      );
    } else if (workerData.aadhaarFrontUrl) {
      registrationWorker.aadhaarFrontPath = workerData.aadhaarFrontUrl;
    }
    if (workerData.aadhaarBackPublicId) {
      registrationWorker.aadhaarBackPath = authenticatedImageUrl(
        workerData.aadhaarBackPublicId,
      );
    } else if (workerData.aadhaarBackUrl) {
      registrationWorker.aadhaarBackPath = workerData.aadhaarBackUrl;
    }
    res.json({ worker: registrationWorker });
  }),
);

router.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const worker = await Worker.findById(req.params.id);
    if (!worker) throw new ApiError(404, "Worker not found.");
    const dateFilter = {};
    if (req.query.from) {
      try {
        dateFilter.$gte = parseLocalDateOnly(req.query.from);
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        throw new ApiError(400, "Invalid start date.");
      }
    }
    if (req.query.to) {
      try {
        dateFilter.$lte = parseLocalDateOnly(req.query.to, true);
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        throw new ApiError(400, "Invalid end date.");
      }
    }
    if (
      dateFilter.$gte &&
      dateFilter.$lte &&
      dateFilter.$gte > dateFilter.$lte
    ) {
      throw new ApiError(400, "Start date cannot be after end date.");
    }
    const attendanceFilter = { worker: worker.id };
    const paymentFilter = { worker: worker.id, deletedAt: null };
    if (Object.keys(dateFilter).length) {
      attendanceFilter.date = dateFilter;
      paymentFilter.paidOn = dateFilter;
    }
    const attendancePage = Math.max(
      1,
      Number.parseInt(req.query.attendancePage, 10) || 1,
    );
    const attendanceLimit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.attendanceLimit, 10) || 10),
    );
    const [payments, attendance, attendanceCount, attendanceSummary] =
      await Promise.all([
        Payment.find(paymentFilter).sort({ paidOn: -1 }),
        Attendance.find(attendanceFilter)
          .sort({ date: -1 })
          .skip((attendancePage - 1) * attendanceLimit)
          .limit(attendanceLimit),
        Attendance.countDocuments(attendanceFilter),
        Attendance.aggregate([
          { $match: { ...attendanceFilter, worker: worker._id } },
          {
            $group: {
              _id: null,
              totalPayable: { $sum: "$payableAmount" },
              days: { $sum: 1 },
              presentDays: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["PRESENT", "DOUBLE_PRESENT", "TRIPLE_PRESENT"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              doubleDays: {
                $sum: { $cond: [{ $eq: ["$status", "DOUBLE_PRESENT"] }, 1, 0] },
              },
              tripleDays: {
                $sum: { $cond: [{ $eq: ["$status", "TRIPLE_PRESENT"] }, 1, 0] },
              },
              halfDays: {
                $sum: { $cond: [{ $eq: ["$status", "HALF_DAY"] }, 1, 0] },
              },
            },
          },
        ]),
      ]);
    const totalPaid = payments
      .filter((payment) => payment.flow === "OUTFLOW" && payment.worker)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const totalReturned = payments
      .filter((payment) => payment.flow === "INFLOW" && payment.worker)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const netPaid = totalPaid - totalReturned;
    const totals = attendanceSummary[0] || {
      totalPayable: 0,
      days: 0,
      presentDays: 0,
      halfDays: 0,
    };
    res.json({
      worker,
      payments,
      attendance,
      attendanceSummary: {
        ...totals,
        totalPaid,
        totalReturned,
        netPaid,
        totalDue: Math.max(0, Number(totals.totalPayable || 0) - netPaid),
        overpaid: Math.max(0, netPaid - Number(totals.totalPayable || 0)),
      },
      attendancePagination: {
        page: attendancePage,
        limit: attendanceLimit,
        total: attendanceCount,
        pages: Math.ceil(attendanceCount / attendanceLimit),
      },
    });
  }),
);

export default router;
