import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";

const fileDir = (storageKey) => path.join(env.storagePath, storageKey);
const chunkDir = (storageKey) => path.join(fileDir(storageKey), "chunks");
const chunkPath = (storageKey, chunkIndex) => path.join(chunkDir(storageKey), `${chunkIndex}.bin`);

export const ensureStorage = async () => {
  await fsp.mkdir(env.storagePath, { recursive: true });
};

export const initializeFileStorage = async (storageKey) => {
  await fsp.mkdir(chunkDir(storageKey), { recursive: true });
};

export const saveChunk = async ({ storageKey, chunkIndex, buffer }) => {
  await initializeFileStorage(storageKey);
  await fsp.writeFile(chunkPath(storageKey, chunkIndex), buffer);
};

export const createChunkReadStream = ({ storageKey, chunkIndex }) =>
  fs.createReadStream(chunkPath(storageKey, chunkIndex));

export const listStoredChunks = async (storageKey) => {
  const targetDir = chunkDir(storageKey);

  try {
    const entries = await fsp.readdir(targetDir);
    return entries
      .map((entry) => Number(entry.replace(".bin", "")))
      .filter((entry) => Number.isFinite(entry))
      .sort((a, b) => a - b);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
};

export const removeFileStorage = async (storageKey) => {
  await fsp.rm(fileDir(storageKey), { recursive: true, force: true });
};
