import mongoose from "mongoose";

const salaryCarryForwardDecisionSchema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    confirmedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

salaryCarryForwardDecisionSchema.index(
  { worker: 1, month: 1 },
  { unique: true },
);

export default mongoose.model(
  "SalaryCarryForwardDecision",
  salaryCarryForwardDecisionSchema,
);
