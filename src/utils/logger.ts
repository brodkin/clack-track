/**
 * Format timestamp for log output
 */
function timestamp(): string {
  return new Date().toISOString();
}

export function log(message: string, ...args: unknown[]): void {
  console.log(`[${timestamp()}] [INFO] ${message}`, ...args);
}

export function error(message: string, ...args: unknown[]): void {
  console.error(`[${timestamp()}] [ERROR] ${message}`, ...args);
}

export function warn(message: string, ...args: unknown[]): void {
  console.warn(`[${timestamp()}] [WARN] ${message}`, ...args);
}

export function debug(message: string, ...args: unknown[]): void {
  if (process.env.DEBUG === 'true') {
    console.debug(`[${timestamp()}] [DEBUG] ${message}`, ...args);
  }
}
