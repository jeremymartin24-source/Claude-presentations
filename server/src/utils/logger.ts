// ANSI color codes
const RESET  = '\x1b[0m';
const CYAN   = '\x1b[36m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GRAY   = '\x1b[90m';

function timestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: string, color: string, message: string): string {
  return `${GRAY}[${timestamp()}]${RESET} ${color}${level}${RESET} ${message}`;
}

export const logger = {
  info(message: string): void {
    console.log(formatMessage('[INFO] ', CYAN, message));
  },

  error(message: string, err?: unknown): void {
    const extra = err instanceof Error ? `\n  ${err.stack ?? err.message}` : '';
    console.error(formatMessage('[ERROR]', RED, message + extra));
  },

  warn(message: string): void {
    console.warn(formatMessage('[WARN] ', YELLOW, message));
  },
};

export default logger;
