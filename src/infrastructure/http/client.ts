import https from "node:https";
import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import type { AppConfig } from "../../config/environment.js";

export interface HttpClient {
  get(url: string): Promise<AxiosResponse>;
  getBuffer(url: string, maxSize: number): Promise<Buffer>;
}

class HttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HttpError";
  }
}

function isAllowedUrl(link: string, allowedDomain: string): boolean {
  const normalizedLink = link.trim();
  try {
    const parsed = new URL(normalizedLink);
    return parsed.origin === new URL(allowedDomain).origin;
  } catch {
    return normalizedLink.startsWith("/");
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new HttpError(
    `Failed after ${maxRetries} retries: ${lastError?.message ?? "unknown error"}`,
  );
}

export function createHttpClient(config: AppConfig): HttpClient {
  const instance: AxiosInstance = axios.create({
    timeout: config.httpTimeout,
    maxContentLength: config.maxContentLength,
    maxBodyLength: config.maxContentLength,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    },
    httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: true }),
  });

  return {
    async get(url: string): Promise<AxiosResponse> {
      if (!isAllowedUrl(url, config.allowedDomain)) {
        throw new HttpError(`Blocked disallowed URL: ${url}`);
      }
      return withRetry(() => instance.get(url));
    },

    async getBuffer(url: string, maxSize: number): Promise<Buffer> {
      if (!isAllowedUrl(url, config.allowedDomain)) {
        throw new HttpError(`Blocked disallowed URL: ${url}`);
      }
      const response = await withRetry(() =>
        instance.get(url, {
          responseType: "arraybuffer",
          timeout: config.httpTimeout,
          maxContentLength: maxSize,
          maxBodyLength: maxSize,
        }),
      );
      return Buffer.from(response.data as ArrayBuffer);
    },
  };
}
