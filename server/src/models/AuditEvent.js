import mongoose from "mongoose";

const auditEventSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "SecureFile", required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, default: null },
    action: { type: String, required: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

auditEventSchema.index({ fileId: 1, createdAt: -1 });

export const AuditEvent = mongoose.model("AuditEvent", auditEventSchema);
