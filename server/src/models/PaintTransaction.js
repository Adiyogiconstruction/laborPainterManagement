import mongoose from "mongoose";

const paintTransactionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      index: true,
    },
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
    siteName: { type: String, trim: true, maxlength: 150 },
    paintName: { type: String, required: true, trim: true, maxlength: 120 },
    kind: {
      type: String,
      enum: ["ISSUED", "PURCHASED", "USED", "RETURNED", "ADJUSTMENT"],
      required: true,
    },
    quantity: { type: Number, required: true },
    unit: { type: String, trim: true, maxlength: 20, default: "LITRE" },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

paintTransactionSchema.index({ paintName: 1, date: -1 });
export default mongoose.model("PaintTransaction", paintTransactionSchema);
