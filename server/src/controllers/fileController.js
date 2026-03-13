import { AccessGrant } from "../models/AccessGrant.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { SecureFile } from "../models/SecureFile.js";
import { UploadSession } from "../models/UploadSession.js";
import { User } from "../models/User.js";
import { logAuditEvent } from "../services/auditService.js";
import { createChunkReadStream, listStoredChunks, removeFileStorage, saveChunk } from "../services/storage/localStorage.js";
import { hashOpaqueToken } from "../services/tokenService.js";

const buildActiveGrantFilter = () => ({
  revokedAt: null,
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
});

const isGrantActive = (grant) => !grant.revokedAt && (!grant.expiresAt || new Date(grant.expiresAt) > new Date());

const findUserGrant = async ({ fileId, userId }) =>
  AccessGrant.findOne({
    fileId,
    userId,
    ...buildActiveGrantFilter()
  }).lean();

const findShareGrant = async ({ shareToken }) =>
  AccessGrant.findOne({
    principalType: "link",
    shareTokenHash: hashOpaqueToken(shareToken),
    ...buildActiveGrantFilter()
  }).lean();

const buildFileView = ({ file, grant }) => ({
  id: file._id.toString(),
  originalName: file.originalName,
  mimeType: file.mimeType,
  size: file.size,
  encryptedSize: file.encryptedSize,
  chunkSize: file.chunkSize,
  chunkCount: file.chunkCount,
  status: file.status,
  encryption: file.encryption,
  createdAt: file.createdAt,
  ownerId: file.ownerId.toString(),
  access: grant
    ? {
        grantId: grant._id.toString(),
        principalType: grant.principalType,
        role: grant.role,
        grantType: grant.grantType,
        wrappedKeyPackage: grant.wrappedKeyPackage,
        expiresAt: grant.expiresAt
      }
    : null
});

const ensureOwner = async ({ fileId, userId }) => {
  const grant = await AccessGrant.findOne({
    fileId,
    userId,
    role: "owner",
    revokedAt: null
  });

  if (!grant) {
    const error = new Error("Owner access is required");
    error.statusCode = 403;
    throw error;
  }

  return grant;
};

export const initiateUpload = async (req, res) => {
  const { originalName, mimeType, size, chunkSize, chunkCount, baseIv, ownerWrappedKeyPackage } = req.body;

  if (!originalName || !mimeType || !size || !chunkSize || !chunkCount || !baseIv || !ownerWrappedKeyPackage) {
    return res.status(400).json({ message: "Incomplete upload metadata" });
  }

  const file = await SecureFile.create({
    ownerId: req.user.id,
    originalName,
    mimeType,
    size,
    chunkSize,
    chunkCount,
    storageKey: `file_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    encryption: {
      algorithm: "AES-GCM",
      keyLength: 256,
      baseIv,
      keyVersion: 1
    }
  });

  const upload = await UploadSession.create({
    fileId: file._id,
    userId: req.user.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 4)
  });

  await AccessGrant.create({
    fileId: file._id,
    userId: req.user.id,
    recipientEmail: req.user.email,
    principalType: "user",
    role: "owner",
    grantType: "owner-password",
    wrappedKeyPackage: ownerWrappedKeyPackage,
    keyVersion: 1,
    createdBy: req.user.id
  });

  await logAuditEvent(req, {
    fileId: file._id,
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: "upload_initiated",
    details: { chunkCount, chunkSize, originalName }
  });

  res.status(201).json({
    uploadId: upload._id.toString(),
    file: buildFileView({
      file,
      grant: {
        _id: file._id,
        principalType: "user",
        role: "owner",
        grantType: "owner-password",
        wrappedKeyPackage: ownerWrappedKeyPackage
      }
    })
  });
};

export const uploadChunk = async (req, res) => {
  const { uploadId, chunkIndex } = req.params;
  const upload = await UploadSession.findById(uploadId);

  if (!upload || upload.status !== "active" || upload.userId.toString() !== req.user.id) {
    return res.status(404).json({ message: "Upload session not found" });
  }

  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ message: "Chunk body must be sent as binary" });
  }

  const file = await SecureFile.findById(upload.fileId);

  if (!file) {
    return res.status(404).json({ message: "File not found for upload session" });
  }

  await saveChunk({
    storageKey: file.storageKey,
    chunkIndex: Number(chunkIndex),
    buffer: req.body
  });

  const numericIndex = Number(chunkIndex);

  if (!upload.receivedChunks.includes(numericIndex)) {
    upload.receivedChunks.push(numericIndex);
    await upload.save();
    file.encryptedSize += req.body.length;
    await file.save();
  }

  res.status(202).json({
    receivedChunks: upload.receivedChunks.length
  });
};

export const completeUpload = async (req, res) => {
  const { uploadId } = req.params;
  const upload = await UploadSession.findById(uploadId);

  if (!upload || upload.userId.toString() !== req.user.id) {
    return res.status(404).json({ message: "Upload session not found" });
  }

  const file = await SecureFile.findById(upload.fileId);

  if (!file) {
    return res.status(404).json({ message: "File not found" });
  }

  const storedChunks = await listStoredChunks(file.storageKey);

  if (storedChunks.length !== file.chunkCount) {
    return res.status(400).json({
      message: `Upload is incomplete. Expected ${file.chunkCount} chunks but found ${storedChunks.length}.`
    });
  }

  upload.status = "completed";
  file.status = "ready";
  await Promise.all([upload.save(), file.save()]);

  await logAuditEvent(req, {
    fileId: file._id,
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: "upload_completed",
    details: { storedChunks: storedChunks.length }
  });

  const ownerGrant = await findUserGrant({ fileId: file._id, userId: req.user.id });

  res.json({
    file: buildFileView({ file, grant: ownerGrant })
  });
};

export const listFiles = async (req, res) => {
  const grants = await AccessGrant.find({
    userId: req.user.id,
    ...buildActiveGrantFilter()
  })
    .populate("fileId")
    .sort({ createdAt: -1 })
    .lean();

  const files = grants
    .filter((grant) => grant.fileId && ["ready", "rotation_required"].includes(grant.fileId.status))
    .map((grant) => buildFileView({ file: grant.fileId, grant }));

  res.json({ files });
};

export const getFileManifest = async (req, res) => {
  const file = await SecureFile.findById(req.params.fileId).lean();

  if (!file) {
    return res.status(404).json({ message: "File not found" });
  }

  const grant = await findUserGrant({ fileId: file._id, userId: req.user.id });

  if (!grant || !isGrantActive(grant)) {
    return res.status(403).json({ message: "No active access grant found" });
  }

  await logAuditEvent(req, {
    fileId: file._id,
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: "download_manifest_requested",
    details: { grantType: grant.grantType }
  });

  res.json({
    file: buildFileView({ file, grant }),
    chunkEndpointTemplate: `/api/files/${file._id.toString()}/chunks/{index}`
  });
};

export const getFileChunk = async (req, res) => {
  const { fileId, chunkIndex } = req.params;
  const file = await SecureFile.findById(fileId).lean();

  if (!file) {
    return res.status(404).json({ message: "File not found" });
  }

  const shareToken = req.get("x-share-token");
  const grant = shareToken
    ? await findShareGrant({ shareToken })
    : await findUserGrant({ fileId, userId: req.user?.id });

  if (!grant || grant.fileId.toString() !== fileId || !isGrantActive(grant)) {
    return res.status(403).json({ message: "Access denied for chunk request" });
  }

  await logAuditEvent(req, {
    fileId: file._id,
    actorId: req.user?.id || null,
    actorEmail: req.user?.email || grant.recipientEmail || "link-share",
    action: "encrypted_chunk_streamed",
    details: { chunkIndex: Number(chunkIndex), principalType: grant.principalType }
  });

  res.setHeader("Content-Type", "application/octet-stream");
  createChunkReadStream({
    storageKey: file.storageKey,
    chunkIndex: Number(chunkIndex)
  }).pipe(res);
};

export const createUserShare = async (req, res) => {
  const { fileId } = req.params;
  const { recipientEmail, wrappedKeyPackage, expiresAt } = req.body;

  if (!recipientEmail || !wrappedKeyPackage) {
    return res.status(400).json({ message: "Recipient email and wrapped key package are required" });
  }

  await ensureOwner({ fileId, userId: req.user.id });

  const recipient = await User.findOne({ email: recipientEmail.trim().toLowerCase() }).lean();

  if (!recipient) {
    return res.status(404).json({ message: "Recipient not found in directory" });
  }

  const file = await SecureFile.findById(fileId).lean();

  if (file.status === "rotation_required") {
    return res.status(409).json({
      message: "This file requires client-side re-encryption with a new key before it can be shared again."
    });
  }

  const grant = await AccessGrant.findOneAndUpdate(
    {
      fileId,
      userId: recipient._id,
      principalType: "user",
      role: "viewer"
    },
    {
      recipientEmail: recipient.email,
      grantType: "ecdh",
      wrappedKeyPackage,
      keyVersion: file.encryption.keyVersion,
      createdBy: req.user.id,
      revokedAt: null,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

  await logAuditEvent(req, {
    fileId,
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: "user_share_created",
    details: { recipientEmail: recipient.email }
  });

  res.status(201).json({
    grant: {
      id: grant._id.toString(),
      recipientEmail: grant.recipientEmail,
      expiresAt: grant.expiresAt
    }
  });
};

export const createLinkShare = async (req, res) => {
  const { fileId } = req.params;
  const { wrappedKeyPackage, expiresAt, shareToken, shareUrlBase } = req.body;

  if (!wrappedKeyPackage || !shareToken) {
    return res.status(400).json({ message: "Wrapped key package and share token are required" });
  }

  await ensureOwner({ fileId, userId: req.user.id });

  const file = await SecureFile.findById(fileId).lean();

  if (file.status === "rotation_required") {
    return res.status(409).json({
      message: "This file requires client-side re-encryption with a new key before it can be shared again."
    });
  }

  const grant = await AccessGrant.create({
    fileId,
    principalType: "link",
    role: "viewer",
    grantType: "link-password",
    wrappedKeyPackage,
    shareTokenHash: hashOpaqueToken(shareToken),
    keyVersion: file.encryption.keyVersion,
    createdBy: req.user.id,
    expiresAt: expiresAt ? new Date(expiresAt) : null
  });

  await logAuditEvent(req, {
    fileId,
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: "link_share_created",
    details: { expiresAt: grant.expiresAt }
  });

  res.status(201).json({
    share: {
      id: grant._id.toString(),
      expiresAt: grant.expiresAt,
      url: `${shareUrlBase || ""}/share/${shareToken}`
    }
  });
};

export const listAccessGrants = async (req, res) => {
  const { fileId } = req.params;
  await ensureOwner({ fileId, userId: req.user.id });

  const grants = await AccessGrant.find({ fileId }).sort({ createdAt: -1 }).lean();

  res.json({
    grants: grants
      .filter((grant) => grant.role !== "owner")
      .map((grant) => ({
        id: grant._id.toString(),
        principalType: grant.principalType,
        recipientEmail: grant.recipientEmail,
        grantType: grant.grantType,
        revokedAt: grant.revokedAt,
        expiresAt: grant.expiresAt,
        createdAt: grant.createdAt
      }))
  });
};

export const resolveShare = async (req, res) => {
  const shareToken = req.params.shareToken;
  const grant = await findShareGrant({ shareToken });

  if (!grant) {
    return res.status(404).json({ message: "Share link not found or expired" });
  }

  const file = await SecureFile.findById(grant.fileId).lean();

  if (!file) {
    return res.status(404).json({ message: "Shared file not found" });
  }

  await logAuditEvent(req, {
    fileId: file._id,
    actorEmail: grant.recipientEmail || "link-share",
    action: "share_link_resolved",
    details: { shareGrantId: grant._id.toString() }
  });

  res.json({
    file: buildFileView({ file, grant }),
    chunkEndpointTemplate: `/api/files/${file._id.toString()}/chunks/{index}`
  });
};

export const revokeGrant = async (req, res) => {
  const { fileId, grantId } = req.params;
  await ensureOwner({ fileId, userId: req.user.id });

  const grant = await AccessGrant.findById(grantId);

  if (!grant || grant.fileId.toString() !== fileId) {
    return res.status(404).json({ message: "Access grant not found" });
  }

  if (grant.role === "owner") {
    return res.status(400).json({ message: "Owner grant cannot be revoked" });
  }

  grant.revokedAt = new Date();
  await grant.save();

  const file = await SecureFile.findById(fileId);
  file.status = "rotation_required";
  file.lastRotationRequiredAt = new Date();
  file.encryption.keyVersion += 1;
  await file.save();

  await logAuditEvent(req, {
    fileId,
    actorId: req.user.id,
    actorEmail: req.user.email,
    action: "access_revoked",
    details: {
      revokedGrantId: grantId,
      nextKeyVersion: file.encryption.keyVersion
    }
  });

  res.json({
    message:
      "Access revoked. The file now requires client-side re-encryption with a new key version before fully secure redistribution.",
    file: buildFileView({ file, grant: await findUserGrant({ fileId, userId: req.user.id }) })
  });
};

export const deleteFile = async (req, res) => {
  const { fileId } = req.params;
  await ensureOwner({ fileId, userId: req.user.id });

  const file = await SecureFile.findById(fileId);

  if (!file) {
    return res.status(404).json({ message: "File not found" });
  }

  const storageKey = file.storageKey;

  await Promise.all([
    AccessGrant.deleteMany({ fileId }),
    UploadSession.deleteMany({ fileId }),
    AuditEvent.deleteMany({ fileId }),
    SecureFile.deleteOne({ _id: fileId })
  ]);

  await removeFileStorage(storageKey);

  res.json({
    message: "Encrypted document and its metadata were removed successfully."
  });
};
