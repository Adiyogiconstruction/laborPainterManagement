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
    labourCount: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    companyLabourRate: { type: Number, required: true, min: 0 },
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

export default mongoose.model(
  "CompanyLabourAssignment",
  companyLabourAssignmentSchema,
);
