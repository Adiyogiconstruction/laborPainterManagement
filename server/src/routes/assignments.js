import { Router } from "express";
import Assignment from "../models/Assignment.js";
import Worker from "../models/Worker.js";
import Payment from "../models/Payment.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { dateRange, pick } from "../utils/serializers.js";

const router = Router();
const editable = [
  "type",
  "worker",
  "workers",
  "client",
  "siteName",
  "workDescription",
  "startDate",
  "endDate",
  "headCount",
  "workDays",
  "clientRate",
  "workerRate",
  "unit",
  "billingAmount",
  "payoutAmount",
  "status",
  "notes",
];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.worker) {
      filter.$or = [
        { worker: req.query.worker },
        { workers: req.query.worker },
      ];
    }
    if (req.query.client) filter.client = req.query.client;
    const range = dateRange(req.query);
    if (range) filter.startDate = range;
    if (req.query.search)
      filter.$or = [
        { siteName: new RegExp(req.query.search, "i") },
        { workDescription: new RegExp(req.query.search, "i") },
      ];
    const assignments = await Assignment.find(filter)
      .populate("worker", "name type phone")
      .populate("workers", "name type phone")
      .populate("client", "name")
      .sort({ startDate: -1, createdAt: -1 });
    res.json({ assignments });
  }),
);

router.post(
  "/",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = pick(req.body, editable);
    if (
      !data.client ||
      !data.type ||
      !data.siteName ||
      !data.workDescription ||
      !data.startDate ||
      data.clientRate === undefined ||
      data.clientRate === null ||
      data.workerRate === undefined ||
      data.workerRate === null
    ) {
      throw new ApiError(
        400,
        "Type, client, site, work description, start date and both rates are required.",
      );
    }
    const selectedWorkers = data.workers?.length
      ? data.workers
      : data.worker
        ? [data.worker]
        : [];
    if (!selectedWorkers.length)
      throw new ApiError(400, "At least one worker is required.");
    const workers = await Worker.find({ _id: { $in: selectedWorkers } });
    if (workers.length !== selectedWorkers.length)
      throw new ApiError(404, "Worker not found.");
    if (workers.some((worker) => worker.type !== data.type))
      throw new ApiError(
        400,
        "Selected workers must match the assignment type.",
      );
    data.workers = selectedWorkers;
    data.worker = selectedWorkers[0];
    const assignment = await Assignment.create({
      ...data,
      createdBy: req.user.id,
    });
    await assignment.populate([
      { path: "worker", select: "name type phone" },
      { path: "workers", select: "name type phone" },
      { path: "client", select: "name" },
    ]);
    res.status(201).json({ assignment });
  }),
);

router.patch(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) throw new ApiError(404, "Work record not found.");
    const next = { ...assignment.toObject(), ...pick(req.body, editable) };
    if (
      !next.client ||
      !next.type ||
      !next.siteName ||
      !next.workDescription ||
      !next.startDate ||
      next.clientRate === undefined ||
      next.clientRate === null ||
      next.workerRate === undefined ||
      next.workerRate === null
    ) {
      throw new ApiError(
        400,
        "Type, client, site, work description, start date and both rates are required.",
      );
    }
    const nextWorkers = req.body.workers?.length
      ? req.body.workers
      : req.body.worker
        ? [req.body.worker]
        : assignment.workers?.length
          ? assignment.workers
          : assignment.worker
            ? [assignment.worker]
            : [];
    const workers = await Worker.find({ _id: { $in: nextWorkers } });
    if (!nextWorkers.length || workers.length !== nextWorkers.length)
      throw new ApiError(400, "At least one valid worker is required.");
    if (workers.some((worker) => worker.type !== next.type))
      throw new ApiError(
        400,
        "Selected workers must match the assignment type.",
      );
    Object.assign(assignment, pick(req.body, editable));
    assignment.workers = nextWorkers;
    assignment.worker = nextWorkers[0];
    await assignment.save();
    await assignment.populate([
      { path: "worker", select: "name type phone" },
      { path: "workers", select: "name type phone" },
      { path: "client", select: "name" },
    ]);
    res.json({ assignment });
  }),
);

router.delete(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) throw new ApiError(404, "Work record not found.");
    const paymentCount = await Promise.all([
      Payment.countDocuments({ assignment: assignment.id }),
    ]).then(([count]) => count);
    if (paymentCount) {
      throw new ApiError(
        409,
        "This work record has linked payments or bills and cannot be deleted.",
      );
    }
    await assignment.deleteOne();
    res.json({ deletedId: assignment.id });
  }),
);

export default router;
