import { Router } from "express";
import Assignment from "../models/Assignment.js";
import Client from "../models/Client.js";
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
    filter.type = "LABOUR";
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
      filter.$or = [{ siteName: new RegExp(req.query.search, "i") }];
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
    const data = { ...pick(req.body, editable), type: "LABOUR" };
    if (
      !data.client ||
      !data.type ||
      !data.siteName ||
      !data.startDate ||
      data.clientRate === undefined ||
      data.clientRate === null
    ) {
      throw new ApiError(
        400,
        "Type, client, site, start date and client rate are required.",
      );
    }
    const client = await Client.findOne({
      _id: data.client,
      businessType: data.type,
      "sites.name": data.siteName,
    });
    if (!client)
      throw new ApiError(400, "Select a site registered for this client.");
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
    const next = {
      ...assignment.toObject(),
      ...pick(req.body, editable),
      type: "LABOUR",
    };
    if (
      !next.client ||
      !next.type ||
      !next.siteName ||
      !next.startDate ||
      next.clientRate === undefined ||
      next.clientRate === null
    ) {
      throw new ApiError(
        400,
        "Type, client, site, start date and client rate are required.",
      );
    }
    const client = await Client.findOne({
      _id: next.client,
      businessType: next.type,
      "sites.name": next.siteName,
    });
    if (!client)
      throw new ApiError(400, "Select a site registered for this client.");
    Object.assign(assignment, pick(req.body, editable));
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
