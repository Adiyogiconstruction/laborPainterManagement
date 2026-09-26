import mongoose from "mongoose";

const workerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["LABOUR"],
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    companyName: { type: String, trim: true, maxlength: 150, default: "" },
    teamName: { type: String, trim: true, maxlength: 100, default: "" },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    aadhaarNumber: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{12}$/, "Aadhaar number must contain 12 digits"],
    },
    address: { type: String, required: true, trim: true, maxlength: 350 },
    skill: { type: String, required: true, trim: true, maxlength: 100 },
    workZone: { type: String, trim: true, maxlength: 100, default: "" },
    photoPath: { type: String, trim: true, default: "" },
    photoUrl: { type: String, trim: true, default: "" },
    photoPublicId: { type: String, trim: true, default: "" },
    aadhaarFrontPath: { type: String, trim: true, default: "" },
    aadhaarBackPath: { type: String, trim: true, default: "" },
    aadhaarFrontUrl: { type: String, trim: true, default: "" },
    aadhaarBackUrl: { type: String, trim: true, default: "" },
    aadhaarFrontPublicId: { type: String, trim: true, default: "" },
    aadhaarBackPublicId: { type: String, trim: true, default: "" },
    ppeKitIssuedOn: { type: Date, default: null },
    defaultDailyRate: { type: Number, required: true, min: 0 },
    overtimeHourlyRate: { type: Number, min: 0, default: 0 },
    joiningDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

workerSchema.index({ type: 1, name: 1, deletedAt: 1 });
export default mongoose.model("Worker", workerSchema);
