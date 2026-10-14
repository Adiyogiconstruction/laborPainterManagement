import mongoose from "mongoose";

const adminUsageDailySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminSession",
      required: true,
    },
    date: { type: String, required: true },
    activeMilliseconds: { type: Number, default: 0 },
    inactiveMilliseconds: { type: Number, default: 0 },
  },
  { timestamps: false },
);

adminUsageDailySchema.index({ session: 1, date: 1 }, { unique: true });
adminUsageDailySchema.index({ date: 1, user: 1 });

export default mongoose.model("AdminUsageDaily", adminUsageDailySchema);
