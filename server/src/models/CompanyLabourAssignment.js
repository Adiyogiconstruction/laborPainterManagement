import mongoose from "mongoose";

const companyLabourAssignmentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyClient",
      required: true,
      index: true,
    },
    companyName: { type: String, required: true, trim: true },
    zone: { type: String, trim: true, maxlength: 100, default: "" },
    labourCount: { type: Number, required: true, min: 1 },
    workerIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Worker" }],
      default: [],
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
    companyLabourRate: { type: Number, required: true, min: 0 },
    companyOvertimeRate: { type: Number, min: 0, default: 0 },
    originalLabourRate: { type: Number, required: true, min: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

companyLabourAssignmentSchema.index({ company: 1, startDate: 1, endDate: 1 });
companyLabourAssignmentSchema.index({
  company: 1,
  workerIds: 1,
  startDate: 1,
  endDate: 1,
});

export default mongoose.model(
  "CompanyLabourAssignment",
  companyLabourAssignmentSchema,
);
