export function assertString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string response from ${context}, got ${typeof value}`);
  }
  return value;
}
