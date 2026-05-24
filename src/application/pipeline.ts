import type { AppConfig } from "../config/environment.js";
import type { Dependencies } from "./useCases/scrapeBoib.js";
import { runScrape } from "./useCases/scrapeBoib.js";

export interface PipelineResult {
  success: boolean;
  error?: string;
}

export async function runScrapePipeline(
  config: AppConfig,
  deps: Dependencies,
): Promise<PipelineResult> {
  try {
    const result = await runScrape(config, deps);
    return { success: result.success };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    deps.logger.error(`Fatal error: ${message}`);

    if (err instanceof Error && err.stack) {
      deps.logger.error(err.stack);
    }

    return { success: false, error: message };
  }
}
