import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    flow: {
      type: String,
      enum: ["INFLOW", "OUTFLOW"],
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: [
        "WAGE",
        "ADVANCE",
        "TRAVEL_ADVANCE",
        "EXPENSE",
        "ADJUSTMENT",
        "OTHER",
      ],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    paidOn: { type: Date, required: true, default: Date.now, index: true },
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
    method: {
      type: String,
      enum: ["CASH", "UPI", "BANK", "CHEQUE", "OTHER"],
      default: "CASH",
    },
    reference: { type: String, trim: true, maxlength: 100 },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

paymentSchema.pre("validate", function validateCounterparty(next) {
  if (this.flow === "INFLOW" && !this.client)
    return next(new Error("Client is required for money received."));
  if (this.flow === "OUTFLOW" && this.kind !== "EXPENSE" && !this.worker) {
    return next(new Error("Worker is required for this payment."));
  }
  if (this.kind === "OTHER" && !String(this.notes || "").trim()) {
    return next(new Error("Please specify the other payment type in notes."));
  }
  next();
});

paymentSchema.index({ paidOn: -1, flow: 1 });
export default mongoose.model("Payment", paymentSchema);
