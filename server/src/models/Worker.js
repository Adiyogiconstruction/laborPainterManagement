import mongoose from "mongoose";

const workerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["LABOUR", "PAINTER"],
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
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
    ppeKitIssuedOn: { type: Date, default: null },
    defaultDailyRate: { type: Number, required: true, min: 0 },
    overtimeHourlyRate: { type: Number, min: 0, default: 0 },
    joiningDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

workerSchema.index({ type: 1, name: 1 });
export default mongoose.model("Worker", workerSchema);
