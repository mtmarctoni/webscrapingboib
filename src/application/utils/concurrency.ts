import type { Logger } from "../../infrastructure/logger.js";

export const PDF_DOWNLOAD_CONCURRENCY = 5;

export async function withConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  logger: Logger,
): Promise<void> {
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const results = await Promise.allSettled(batch.map(fn));
    for (const result of results) {
      if (result.status === "rejected") {
        const message =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        logger.warn(`Concurrent task failed: ${message}`);
      }
    }
  }
}
