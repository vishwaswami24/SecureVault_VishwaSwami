import mongoose from "mongoose";

const encryptedBundleSchema = new mongoose.Schema(
  {
    algorithm: { type: String, default: "AES-GCM" },
    iterations: { type: Number, required: true },
    salt: { type: String, required: true },
    iv: { type: String, required: true },
    ciphertext: { type: String, required: true }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    passwordIterations: { type: Number, required: true },
    roles: {
      type: [String],
      default: ["user"]
    },
    publicKeyJwk: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    encryptedPrivateKeyBundle: {
      type: encryptedBundleSchema,
      required: true
    }
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model("User", userSchema);

