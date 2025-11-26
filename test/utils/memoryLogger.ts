export type LogEntry = { level: string; message: string; meta?: Record<string, unknown> };

export class MemoryLogger {
  public entries: LogEntry[] = [];

  debug(message: string, meta?: Record<string, unknown>) {
    this.entries.push({ level: 'debug', message, meta });
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.entries.push({ level: 'info', message, meta });
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.entries.push({ level: 'warn', message, meta });
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.entries.push({ level: 'error', message, meta });
  }
}
