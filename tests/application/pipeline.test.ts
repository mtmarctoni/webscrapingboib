import { beforeEach, describe, expect, it, vi } from "vitest";
import { runScrapePipeline } from "../../src/application/pipeline.js";
import type { Dependencies } from "../../src/application/useCases/scrapeBoib.js";
import type { AppConfig } from "../../src/config/environment.js";
import { makeConfig } from "../helpers.js";

const mockRunScrape = vi.hoisted(() => vi.fn());

vi.mock("../../src/application/useCases/scrapeBoib.js", () => ({
  runScrape: mockRunScrape,
}));

function makeDeps(): Dependencies {
  return {
    http: {} as Dependencies["http"],
    fs: {} as Dependencies["fs"],
    email: {} as Dependencies["email"],
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      spinner: vi.fn() as unknown as Dependencies["logger"]["spinner"],
    },
  };
}

describe("runScrapePipeline", () => {
  let deps: Dependencies;
  let config: AppConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = makeDeps();
    config = makeConfig();
  });

  it("returns success when runScrape succeeds", async () => {
    mockRunScrape.mockResolvedValue({ success: true });
    const result = await runScrapePipeline(config, deps);
    expect(result).toEqual({ success: true });
  });

  it("returns success:false when runScrape returns success:false", async () => {
    mockRunScrape.mockResolvedValue({ success: false });
    const result = await runScrapePipeline(config, deps);
    expect(result).toEqual({ success: false });
  });

  it("catches thrown Error and returns failure result", async () => {
    mockRunScrape.mockRejectedValue(new Error("Something broke"));
    const result = await runScrapePipeline(config, deps);
    expect(result).toEqual({ success: false, error: "Something broke" });
    expect(deps.logger.error).toHaveBeenCalledWith("Fatal error: Something broke");
  });

  it("logs the stack trace when the error has one", async () => {
    const err = new Error("With stack");
    err.stack = "Error: With stack\n    at test.js:1:1";
    mockRunScrape.mockRejectedValue(err);
    await runScrapePipeline(config, deps);
    expect(deps.logger.error).toHaveBeenCalledWith(err.stack);
  });

  it("does not log stack when error is not an Error instance", async () => {
    mockRunScrape.mockRejectedValue("string error");
    await runScrapePipeline(config, deps);
    expect(deps.logger.error).toHaveBeenCalledTimes(1);
    expect(deps.logger.error).toHaveBeenCalledWith("Fatal error: string error");
  });

  it("does not log stack when Error has no stack property", async () => {
    const err = new Error("No stack");
    delete err.stack;
    mockRunScrape.mockRejectedValue(err);
    await runScrapePipeline(config, deps);
    expect(deps.logger.error).toHaveBeenCalledTimes(1);
  });
});
