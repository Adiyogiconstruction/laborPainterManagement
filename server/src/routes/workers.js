import { Router } from "express";
import Worker from "../models/Worker.js";
import Payment from "../models/Payment.js";
import Attendance from "../models/Attendance.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { pick } from "../utils/serializers.js";
import { recordAdminActivity } from "../utils/adminActivity.js";
import { parseWorkerSearch } from "../utils/workerSearch.js";
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

      if (status !== undefined) filter.active = status;

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
            flow: "OUTFLOW",
          },
        },
        { $group: { _id: "$worker", totalPaid: { $sum: "$amount" } } },
      ]),
    ]);
    const payableByWorker = new Map(
      payableRows.map((row) => [
        String(row._id),
        Number(row.totalPayable || 0),
      ]),
    );
    const paidByWorker = new Map(
      paidRows.map((row) => [String(row._id), Number(row.totalPaid || 0)]),
    );
    res.json({
      workers: workers.map((worker) => {
        const totalPayable = payableByWorker.get(String(worker._id)) || 0;
        const totalPaid = paidByWorker.get(String(worker._id)) || 0;
        const workerData = worker.toObject();
        if (workerData.aadhaarFrontPublicId)
          workerData.aadhaarFrontPath = authenticatedImageUrl(
            workerData.aadhaarFrontPublicId,
          );
        if (workerData.aadhaarBackPublicId)
          workerData.aadhaarBackPath = authenticatedImageUrl(
            workerData.aadhaarBackPublicId,
          );
        return {
          ...workerData,
          totalPayable,
          totalPaid,
          totalDue: Math.max(0, totalPayable - totalPaid),
          overpaid: Math.max(0, totalPaid - totalPayable),
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
      !data.type ||
      !data.name ||
      !data.phone ||
      !data.aadhaarNumber ||
      !data.address ||
      !data.skill ||
      data.defaultDailyRate === undefined ||
      data.defaultDailyRate === null ||
      !data.joiningDate
    ) {
      throw new ApiError(
        400,
        "Worker type, name, phone, Aadhaar, address, skill, daily rate and joining date are required.",
      );
    }
    const worker = await Worker.create(data);
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
    if (
      !data.type ||
      !data.name ||
      !data.phone ||
      !data.aadhaarNumber ||
      !data.address ||
      !data.skill ||
      data.defaultDailyRate === undefined ||
      data.defaultDailyRate === null ||
      !data.joiningDate
    ) {
      throw new ApiError(
        400,
        "Worker type, name, phone, Aadhaar, address, skill, daily rate and joining date are required.",
      );
    }
    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      { ...normalizeWorkerFields(pick(req.body, editable)), type: "LABOUR" },
      { new: true, runValidators: true },
    );
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} updated worker profile for ${worker.name}.`,
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
  "/:id/history",
  asyncHandler(async (req, res) => {
    const worker = await Worker.findById(req.params.id);
    if (!worker) throw new ApiError(404, "Worker not found.");
    const dateFilter = {};
    if (req.query.from) {
      const from = new Date(`${req.query.from}T00:00:00.000Z`);
      if (Number.isNaN(from.getTime()))
        throw new ApiError(400, "Invalid start date.");
      dateFilter.$gte = from;
    }
    if (req.query.to) {
      const to = new Date(`${req.query.to}T23:59:59.999Z`);
      if (Number.isNaN(to.getTime()))
        throw new ApiError(400, "Invalid end date.");
      dateFilter.$lte = to;
    }
    if (
      dateFilter.$gte &&
      dateFilter.$lte &&
      dateFilter.$gte > dateFilter.$lte
    ) {
      throw new ApiError(400, "Start date cannot be after end date.");
    }
    const attendanceFilter = { worker: worker.id };
    const paymentFilter = { worker: worker.id };
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
                    { $in: ["$status", ["PRESENT", "DOUBLE_PRESENT"]] },
                    1,
                    0,
                  ],
                },
              },
              doubleDays: {
                $sum: { $cond: [{ $eq: ["$status", "DOUBLE_PRESENT"] }, 1, 0] },
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
        totalDue: Math.max(0, Number(totals.totalPayable || 0) - totalPaid),
        overpaid: Math.max(0, totalPaid - Number(totals.totalPayable || 0)),
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
