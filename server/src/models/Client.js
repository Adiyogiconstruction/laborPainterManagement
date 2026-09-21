import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    contactPerson: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    identityType: {
      type: String,
      required: true,
      enum: ["AADHAAR", "PAN"],
    },
    identityNumber: { type: String, required: true, trim: true, maxlength: 30 },
    gstin: { type: String, trim: true, uppercase: true, maxlength: 20 },
    panNumber: { type: String, trim: true, uppercase: true, maxlength: 10 },
    placeOfSupply: { type: String, trim: true, maxlength: 100 },
    billingAddress: { type: String, trim: true, maxlength: 500 },
    sites: [
      {
        name: { type: String, trim: true },
        address: { type: String, trim: true },
      },
    ],
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

export default mongoose.model("Client", clientSchema);
