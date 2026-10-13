import mongoose from "mongoose";

const companyWorkerRateSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyClient",
      required: true,
      index: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
      index: true,
    },
    applicableFrom: { type: Date, required: true },
    companyDailyRate: { type: Number, min: 0, default: null },
    companyOvertimeRate: { type: Number, min: 0, default: 0 },
    labourDailyRate: { type: Number, min: 0, required: true },
    labourOvertimeRate: { type: Number, min: 0, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

companyWorkerRateSchema.index(
  { company: 1, worker: 1, applicableFrom: 1 },
  { unique: true },
);

export default mongoose.model("CompanyWorkerRate", companyWorkerRateSchema);
