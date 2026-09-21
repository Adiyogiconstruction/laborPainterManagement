import { Router } from "express";
import Worker from "../models/Worker.js";
import Payment from "../models/Payment.js";
import Assignment from "../models/Assignment.js";
import Attendance from "../models/Attendance.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { pick } from "../utils/serializers.js";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = Router();
const serverDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const photoDirectory = path.join(serverDirectory, "uploads", "workers");
fs.mkdirSync(photoDirectory, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, photoDirectory),
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
      callback(null, `${req.params.id}-${Date.now()}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/"));
  },
});
const editable = [
  "type",
  "name",
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
    if (req.query.type) filter.type = req.query.type;
    if (req.query.active !== undefined)
      filter.active = req.query.active === "true";
    if (req.query.search) filter.name = new RegExp(req.query.search, "i");
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
        return {
          ...worker.toObject(),
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
    if (!worker) {
      fs.unlinkSync(req.file.path);
      throw new ApiError(404, "Worker not found.");
    }
    if (worker.photoPath) {
      const oldPath = path.resolve(
        serverDirectory,
        worker.photoPath.replace(/^\//, ""),
      );
      if (oldPath.startsWith(photoDirectory) && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    worker.photoPath = `/uploads/workers/${req.file.filename}`;
    await worker.save();
    res.json({
      worker,
      photoUrl: `${req.protocol}://${req.get("host")}${worker.photoPath}`,
    });
  }),
);

router.post(
  "/",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = pick(req.body, editable);
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
    const data = { ...existing.toObject(), ...pick(req.body, editable) };
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
      pick(req.body, editable),
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
    const [payments, attendance, assignments, attendanceSummary] =
      await Promise.all([
        Payment.find({ worker: worker.id })
          .populate("assignment", "siteName workDescription")
          .sort({ paidOn: -1 }),
        Attendance.find({ worker: worker.id })
          .populate("assignment", "siteName workDescription")
          .sort({ date: -1 }),
        Assignment.find({
          $or: [{ worker: worker.id }, { workers: worker.id }],
        })
          .populate("client", "name")
          .sort({ startDate: -1 }),
        Attendance.aggregate([
          { $match: { worker: worker._id } },
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
      assignments,
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
