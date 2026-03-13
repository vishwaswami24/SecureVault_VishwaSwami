import { AuditEvent } from "../models/AuditEvent.js";

const getRequestIp = (req) => req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null;

export const logAuditEvent = async (req, { fileId, actorId = null, actorEmail = null, action, details = {} }) => {
  await AuditEvent.create({
    fileId,
    actorId,
    actorEmail,
    action,
    details,
    ip: getRequestIp(req),
    userAgent: req.get("user-agent") || null
  });
};

