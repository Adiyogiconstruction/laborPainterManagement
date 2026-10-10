import mongoose from "mongoose";

const adminSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
  },
  { timestamps: false },
);

adminSessionSchema.index({ startedAt: 1, expiresAt: 1 });
adminSessionSchema.index({ user: 1, startedAt: -1 });

export default mongoose.model("AdminSession", adminSessionSchema);
