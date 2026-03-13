import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const resolveStoragePath = () => {
  if (process.env.STORAGE_PATH) {
    return path.resolve(process.cwd(), process.env.STORAGE_PATH);
  }

  return path.resolve(process.cwd(), "storage");
};

export const env = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/securevault",
  jwtSecret: process.env.JWT_SECRET || "development-insecure-secret",
  jwtTtlSeconds: Number(process.env.JWT_TTL_SECONDS || 60 * 60 * 12),
  storagePath: resolveStoragePath()
};

