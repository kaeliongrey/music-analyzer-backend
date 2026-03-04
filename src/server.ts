import app from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";

async function main() {
  await connectDatabase();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
