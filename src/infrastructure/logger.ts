import ora from "ora";

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  spinner(text: string): {
    start(): void;
    text: string;
    succeed(text?: string): void;
    warn(text?: string): void;
  };
}

export function createLogger(): Logger {
  return {
    info(message: string): void {
      console.log(message);
    },
    warn(message: string): void {
      console.warn(message);
    },
    error(message: string): void {
      console.error(message);
    },
    spinner(text: string) {
      const spinner = ora(text);
      return {
        start() {
          spinner.start();
        },
        get text() {
          return spinner.text;
        },
        set text(value: string) {
          spinner.text = value;
        },
        succeed(message?: string) {
          spinner.succeed(message);
        },
        warn(message?: string) {
          if (message) {
            spinner.warn(message);
          } else {
            spinner.warn();
          }
        },
      };
    },
  };
}
