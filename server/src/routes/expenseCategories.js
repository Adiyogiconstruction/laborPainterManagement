import { Router } from "express";
import ExpenseCategory from "../models/ExpenseCategory.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({
      categories: await ExpenseCategory.find({ active: true }).sort({
        name: 1,
      }),
    });
  }),
);
router.post(
  "/",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    if (!req.body.name) throw new ApiError(400, "Category name is required.");
    const category = await ExpenseCategory.create({
      ...req.body,
      createdBy: req.user.id,
    });
    res.status(201).json({ category });
  }),
);
router.patch(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const category = await ExpenseCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );
    if (!category) throw new ApiError(404, "Expense category not found.");
    res.json({ category });
  }),
);
export default router;
