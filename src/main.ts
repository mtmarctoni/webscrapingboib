import { loadConfig, type AppConfig } from "./config/environment.js";
import { createHttpClient } from "./infrastructure/http/client.js";
import { createFileSystem } from "./infrastructure/storage/fileSystem.js";
import { createEmailTransport } from "./infrastructure/email/transport.js";
import { createLogger } from "./infrastructure/logger.js";
import { runScrapePipeline } from "./application/pipeline.js";

async function main(): Promise<void> {
  console.log("----------");
  console.log(new Date(Date.now()));

  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Configuration error: ${message}`);
    console.error("Please check your .env file and ensure all required variables are set.");
    process.exit(1);
  }

  const http = createHttpClient(config);
  const fs = createFileSystem(config);
  const email = createEmailTransport(config);
  const logger = createLogger();

  const result = await runScrapePipeline(config, { http, fs, email, logger });

  console.log("----------");
  process.exit(result.success ? 0 : 1);
}

main();
