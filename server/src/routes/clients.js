import { Router } from "express";
import Client from "../models/Client.js";
import Assignment from "../models/Assignment.js";
import Payment from "../models/Payment.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { pick } from "../utils/serializers.js";

const router = Router();
const editable = [
  "name",
  "contactPerson",
  "phone",
  "identityType",
  "identityNumber",
  "gstin",
  "panNumber",
  "placeOfSupply",
  "billingAddress",
  "sites",
  "active",
  "notes",
];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.active !== undefined)
      filter.active = req.query.active === "true";
    if (req.query.search) filter.name = new RegExp(req.query.search, "i");
    res.json({ clients: await Client.find(filter).sort({ name: 1 }) });
  }),
);

router.post(
  "/",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = pick(req.body, editable);
    if (
      !data.name ||
      !data.phone ||
      !data.identityType ||
      !data.identityNumber
    ) {
      throw new ApiError(
        400,
        "Client name, phone and Aadhaar/PAN details are required.",
      );
    }
    const client = await Client.create(data);
    res.status(201).json({ client });
  }),
);

router.patch(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await Client.findById(req.params.id);
    if (!existing) throw new ApiError(404, "Client not found.");
    const next = { ...existing.toObject(), ...pick(req.body, editable) };
    if (
      !next.name ||
      !next.phone ||
      !next.identityType ||
      !next.identityNumber
    ) {
      throw new ApiError(
        400,
        "Client name, phone and Aadhaar/PAN details are required.",
      );
    }
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      pick(req.body, editable),
      { new: true, runValidators: true },
    );
    res.json({ client });
  }),
);

router.delete(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const client = await Client.findById(req.params.id);
    if (!client) throw new ApiError(404, "Client not found.");
    const [assignmentCount, paymentCount] = await Promise.all([
      Assignment.countDocuments({ client: client.id }),
      Payment.countDocuments({ client: client.id }),
    ]);
    if (assignmentCount || paymentCount) {
      throw new ApiError(
        409,
        "This client has linked work, bills or payment history. Deactivate the client instead of deleting it.",
      );
    }
    await client.deleteOne();
    res.json({ deletedId: client.id });
  }),
);

export default router;
