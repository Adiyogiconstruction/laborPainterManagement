import mongoose from "mongoose";

const companyProfileSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "Maharashtra" },
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    mobile: { type: String, trim: true, default: "" },
    pan: { type: String, trim: true, uppercase: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    bankDetails: {
      accountName: { type: String, trim: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
      bankName: { type: String, trim: true, default: "" },
      branch: { type: String, trim: true, default: "" },
      ifsc: { type: String, trim: true, uppercase: true, default: "" },
      upiId: { type: String, trim: true, default: "" },
    },
  },
  { timestamps: true },
);

export default mongoose.model("CompanyProfile", companyProfileSchema);
