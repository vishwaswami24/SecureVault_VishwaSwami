import mongoose from "mongoose";

const accessGrantSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "SecureFile", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    recipientEmail: { type: String, default: null, trim: true, lowercase: true },
    principalType: {
      type: String,
      enum: ["user", "link"],
      required: true
    },
    role: {
      type: String,
      enum: ["owner", "viewer"],
      required: true
    },
    grantType: {
      type: String,
      enum: ["owner-password", "ecdh", "link-password"],
      required: true
    },
    shareTokenHash: { type: String, default: null, index: true },
    wrappedKeyPackage: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    keyVersion: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    revokedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

accessGrantSchema.index(
  { fileId: 1, userId: 1, role: 1 },
  { partialFilterExpression: { userId: { $type: "objectId" } } }
);

export const AccessGrant = mongoose.model("AccessGrant", accessGrantSchema);

