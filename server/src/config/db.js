import mongoose from "mongoose";
import { env } from "./env.js";

export const connectToDatabase = async () => {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
};

