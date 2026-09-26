import mongoose from "mongoose";

const adminActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    role: {
      type: String,
      enum: ["OWNER", "ADMIN", "VIEWER"],
      default: "ADMIN",
    },
    action: {
      type: String,
      enum: [
        "LOGIN",
        "LOGOUT",
        "SETUP",
        "CREATE",
        "UPDATE",
        "DELETE",
        "PASSWORD_RESET",
        "ACCESS_TOGGLE",
        "ROLE_CHANGE",
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

adminActivitySchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("AdminActivity", adminActivitySchema);
