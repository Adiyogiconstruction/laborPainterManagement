import { Router } from "express";
import Worker from "../models/Worker.js";
import Payment from "../models/Payment.js";
import Assignment from "../models/Assignment.js";
import Attendance from "../models/Attendance.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { pick } from "../utils/serializers.js";
import multer from "multer";
import {
  authenticatedImageUrl,
  deleteImage,
  uploadImage,
} from "../services/cloudinary.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(
      null,
      ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
    );
  },
});
const aadhaarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(
      null,
      ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
    );
  },
});
const editable = [
  "type",
  "name",
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

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    filter.type = "LABOUR";
    if (req.query.active !== undefined)
      filter.active = req.query.active === "true";
    if (req.query.search) {
      const escapedSearch = String(req.query.search).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      const search = new RegExp(escapedSearch.slice(0, 80), "i");
      filter.$or = [
        { name: search },
        { teamName: search },
        { workZone: search },
      ];
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
    worker.photoUrl = uploaded.secure_url;
    worker.photoPath = uploaded.secure_url;
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
    const data = { ...pick(req.body, editable), type: "LABOUR" };
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
      ...pick(req.body, editable),
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
      { ...pick(req.body, editable), type: "LABOUR" },
      { new: true, runValidators: true },
    );
    res.json({ worker });
  }),
);

router.delete(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const worker = await Worker.findById(req.params.id);
    if (!worker) throw new ApiError(404, "Worker not found.");
    const [assignmentCount, paymentCount] = await Promise.all([
      Assignment.countDocuments({ worker: worker.id }),
      Payment.countDocuments({ worker: worker.id }),
    ]);
    if (assignmentCount || paymentCount) {
      throw new ApiError(
        409,
        "This worker has linked work or payment history. Deactivate the worker instead of deleting it.",
      );
    }
    await worker.deleteOne();
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
    const [payments, attendance, attendanceSummary] = await Promise.all([
      Payment.find(paymentFilter)
        .populate("assignment", "siteName workDescription")
        .sort({ paidOn: -1 }),
      Attendance.find(attendanceFilter)
        .populate("assignment", "siteName workDescription")
        .sort({ date: -1 }),
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
    });
  }),
);

export default router;
