import mongoose from "mongoose";

const attendanceSheetSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["ALL", "LABOUR", "PAINTER"],
      required: true,
      index: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      default: null,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    locked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

attendanceSheetSchema.index(
  { type: 1, assignment: 1, date: 1 },
  { unique: true },
);

export default mongoose.model("AttendanceSheet", attendanceSheetSchema);
