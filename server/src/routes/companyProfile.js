import { Router } from "express";
import CompanyProfile from "../models/CompanyProfile.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { recordAdminActivity } from "../utils/adminActivity.js";
import { pick } from "../utils/serializers.js";

const router = Router();
const editable = [
  "companyName",
  "address",
  "pincode",
  "state",
  "gstin",
  "mobile",
  "pan",
  "email",
  "rules",
  "bankDetails",
];

const defaults = {
  companyName: "ADIYOGI CONSTRUCTIONS",
  address:
    "A-1001, Sai Hanuman Tower Rai Uttan Road, Bhayander West, THANE, Maharashtra",
  pincode: "401101",
  state: "Maharashtra",
  gstin: "27ACAFA7740F1ZL",
  mobile: "8879621052",
  pan: "ACAFA7740F",
  email: "adiyogiconstruction1@gmail.com",
  rules: [
    "PPE is mandatory at all times.",
    "Consumption of alcohol or tobacco at the worksite is strictly prohibited.",
    "Follow all safety guidelines provided by the supervisor.",
    "Report any injury immediately to the supervisor.",
    "Maintain cleanliness at the worksite.",
  ],
  bankDetails: {
    accountName: "ADIYOGI CONSTRUCTIONS",
    accountNumber: "643605051514",
    bankName: "ICICI Bank",
    branch: "JUHU",
    ifsc: "ICIC0006436",
    upiId: "8879621052.IBZ@ICICI",
  },
};

async function getOrCreate() {
  let profile = await CompanyProfile.findOne().sort({ createdAt: 1 });
  if (!profile) profile = await CompanyProfile.create(defaults);
  return profile;
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ profile: await getOrCreate() });
  }),
);

router.patch(
  "/",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const current = await getOrCreate();
    const data = pick(req.body, editable);
    if (!data.companyName) throw new ApiError(400, "Company name is required.");
    Object.assign(current, data);
    await current.save();
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} updated the company profile and PDF rules.`,
      { section: "company-profile" },
    );
    res.json({ profile: current });
  }),
);

export default router;
