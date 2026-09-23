import { Router } from "express";
import DailyEntry from "../models/DailyEntry.js";
import Worker from "../models/Worker.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { dateRange, pick } from "../utils/serializers.js";

const router = Router();
const editable = [
  "date",
  "client",
  "assignment",
  "worker",
  "siteName",
  "floor",
  "workDescription",
  "quantity",
  "unit",
  "status",
  "expenseAmount",
  "expenseCategory",
  "notes",
];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.worker) filter.worker = req.query.worker;
    if (req.query.client) filter.client = req.query.client;
    if (req.query.siteName)
      filter.siteName = new RegExp(req.query.siteName, "i");
    if (req.query.type && !req.query.worker) {
      const workers = await Worker.find({ type: "LABOUR" }).select("_id");
      const workerIds = workers.map((worker) => worker._id);
      if (workerIds.length) {
        filter.worker = { $in: workerIds };
      }
    }
    const range = dateRange(req.query);
    if (range) filter.date = range;
    const entries = await DailyEntry.find(filter)
      .populate("worker", "name type")
      .populate("client", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json({ entries });
  }),
);

router.post(
  "/",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = pick(req.body, editable);
    if (!data.date || !data.siteName || !data.workDescription) {
      throw new ApiError(400, "Date, site and work description are required.");
    }
    const entry = await DailyEntry.create({ ...data, createdBy: req.user.id });
    await entry.populate([
      { path: "worker", select: "name type" },
      { path: "client", select: "name" },
    ]);
    res.status(201).json({ entry });
  }),
);

router.patch(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const entry = await DailyEntry.findByIdAndUpdate(
      req.params.id,
      pick(req.body, editable),
      { new: true, runValidators: true },
    )
      .populate("worker", "name type")
      .populate("client", "name");
    if (!entry) throw new ApiError(404, "Daily entry not found.");
    res.json({ entry });
  }),
);

router.delete(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const entry = await DailyEntry.findByIdAndDelete(req.params.id);
    if (!entry) throw new ApiError(404, "Daily entry not found.");
    res.json({ deletedId: entry.id });
  }),
);

export default router;
