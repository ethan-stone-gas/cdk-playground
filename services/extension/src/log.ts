export function log(
  level: "info" | "warn" | "error",
  message: string,
  ...optionalParams: any[]
) {
  const prefix = "[layer:ratelimit-extension]";

  const method =
    level === "info"
      ? console.info
      : level === "warn"
      ? console.warn
      : console.error;

  method(`${prefix} ${message}`, ...optionalParams);
}
