import { createApp } from "./app.js";
import { connectToDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { ensureStorage } from "./services/storage/localStorage.js";

const start = async () => {
  await connectToDatabase();
  await ensureStorage();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`SecureVault API listening on http://localhost:${env.port}`);
  });
};

start().catch((error) => {
  console.error("Failed to boot SecureVault API", error);
  process.exit(1);
});
