import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../../src/infrastructure/logger.js";

vi.mock("ora", () => ({
  default: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    warn: vi.fn(),
    get text() {
      return "mock";
    },
    set text(_v: string) {},
  }),
}));

describe("createLogger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("logs info messages to console.log", () => {
    const logger = createLogger();
    logger.info("hello");
    expect(logSpy).toHaveBeenCalledWith("hello");
  });

  it("logs warn messages to console.warn", () => {
    const logger = createLogger();
    logger.warn("beware");
    expect(warnSpy).toHaveBeenCalledWith("beware");
  });

  it("logs error messages to console.error", () => {
    const logger = createLogger();
    logger.error("oops");
    expect(errorSpy).toHaveBeenCalledWith("oops");
  });

  it("spinner returns an object with expected interface", () => {
    const logger = createLogger();
    const spinner = logger.spinner("loading");
    expect(spinner).toHaveProperty("start");
    expect(spinner).toHaveProperty("succeed");
    expect(spinner).toHaveProperty("warn");
    expect(typeof spinner.text).toBe("string");
  });
});
