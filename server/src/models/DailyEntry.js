import mongoose from "mongoose";

const dailyEntrySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      index: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      index: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      index: true,
    },
    siteName: { type: String, required: true, trim: true, maxlength: 150 },
    floor: { type: String, trim: true, maxlength: 80 },
    workDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    quantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, trim: true, maxlength: 30, default: "UNIT" },
    status: {
      type: String,
      enum: ["WORKING", "TRAVELLING", "NO_WORK"],
      default: "WORKING",
    },
    paintPurchased: { type: Number, min: 0, default: 0 },
    paintUsed: { type: Number, min: 0, default: 0 },
    expenseAmount: { type: Number, min: 0, default: 0 },
    expenseCategory: { type: String, trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

dailyEntrySchema.index({ date: -1, siteName: 1 });
export default mongoose.model("DailyEntry", dailyEntrySchema);
