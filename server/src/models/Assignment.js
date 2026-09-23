import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["LABOUR"],
      required: true,
      index: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      index: true,
      default: null,
    },
    workers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Worker",
        index: true,
      },
    ],
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    siteName: { type: String, required: true, trim: true, maxlength: 150 },
    workDescription: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date },
    headCount: { type: Number, min: 1, default: 1 },
    workDays: { type: Number, min: 0, default: 1 },
    clientRate: { type: Number, min: 0, default: 0 },
    workerRate: { type: Number, min: 0, default: 0 },
    unit: {
      type: String,
      enum: ["DAY", "JOB", "SQFT", "LUMPSUM"],
      default: "DAY",
    },
    billingAmount: { type: Number, min: 0, default: 0 },
    payoutAmount: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "ON_HOLD", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

assignmentSchema.pre("validate", function calculateTotals(next) {
  const people = Number(this.headCount || 0);
  const days = Number(this.workDays || 0);
  const clientMultiplier = this.unit === "DAY" ? people * days : 1;
  const workerMultiplier =
    this.unit === "DAY" ? people * days : this.unit === "JOB" ? people : 1;
  this.billingAmount = Number(this.clientRate || 0) * clientMultiplier;
  this.payoutAmount = Number(this.workerRate || 0) * workerMultiplier;
  next();
});

assignmentSchema.index({ type: 1, status: 1, startDate: -1 });
export default mongoose.model("Assignment", assignmentSchema);
