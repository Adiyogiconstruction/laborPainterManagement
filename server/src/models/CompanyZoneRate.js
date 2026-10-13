import mongoose from "mongoose";

const companyZoneRateSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyClient",
      required: true,
      index: true,
    },
    zone: { type: String, required: true, trim: true, maxlength: 100 },
    applicableFrom: { type: Date, required: true },
    dailyRate: { type: Number, min: 0, required: true },
    overtimeHourlyRate: { type: Number, min: 0, default: 0 },
    labourDailyRate: { type: Number, min: 0, default: 0 },
    labourOvertimeRate: { type: Number, min: 0, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

companyZoneRateSchema.index(
  { company: 1, zone: 1, applicableFrom: 1 },
  { unique: true },
);

export default mongoose.model("CompanyZoneRate", companyZoneRateSchema);
