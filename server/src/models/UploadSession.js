import mongoose from "mongoose";

const uploadSessionSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "SecureFile", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receivedChunks: {
      type: [Number],
      default: []
    },
    status: {
      type: String,
      enum: ["active", "completed", "expired"],
      default: "active"
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

uploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UploadSession = mongoose.model("UploadSession", uploadSessionSchema);

