import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: [
        "NOT_MARKED",
        "PRESENT",
        "DOUBLE_PRESENT",
        "ABSENT",
        "HALF_DAY",
        "LEAVE",
      ],
      default: "NOT_MARKED",
      index: true,
    },
    workUnits: { type: Number, min: 0, max: 2, default: 0 },
    hours: { type: Number, min: 0, max: 24, default: 8 },
    checkIn: { type: String, trim: true, maxlength: 20 },
    checkOut: { type: String, trim: true, maxlength: 20 },
    overtimeHours: { type: Number, min: 0, max: 16, default: 0 },
    dailyRate: { type: Number, min: 0, default: 0 },
    overtimeRate: { type: Number, min: 0, default: 0 },
    payableAmount: { type: Number, min: 0, default: 0 },
    leaveReason: { type: String, trim: true, maxlength: 250 },
    notes: { type: String, trim: true, maxlength: 500 },
    locked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

attendanceSchema.index({ worker: 1, date: 1 }, { unique: true });
attendanceSchema.index({ type: 1, date: 1 });

export default mongoose.model("Attendance", attendanceSchema);
