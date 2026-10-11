import mongoose from "mongoose";

const companyClientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    location: { type: String, trim: true, maxlength: 200, default: "" },
    gstin: { type: String, trim: true, uppercase: true, maxlength: 30, default: "" },
    contact: { type: String, trim: true, maxlength: 30, default: "" },
    email: { type: String, trim: true, lowercase: true, maxlength: 150, default: "" },
    companyLabourRate: { type: Number, min: 0, default: 0 },
    originalLabourRate: { type: Number, min: 0, default: 0 },
    zones: {
      type: [{ type: String, trim: true, maxlength: 100 }],
      default: [],
    },
    active: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

companyClientSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

export default mongoose.model("CompanyClient", companyClientSchema);
