export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  FATAL = "FATAL"
}

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: any;
}

class StructuredLogger {
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 200;

  private formatLog(level: LogLevel, message: string, context?: any): LogEntry {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      context
    };

    // Keep buffer bounded
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    return entry;
  }

  info(message: string, context?: any) {
    this.formatLog(LogLevel.INFO, message, context);
    console.log(
      `%c[INFO] %c[${new Date().toLocaleTimeString()}] %c${message}`,
      "color: #06b6d4; font-weight: bold;",
      "color: #64748b;",
      "color: inherit;",
      context !== undefined ? context : ""
    );
  }

  warn(message: string, context?: any) {
    this.formatLog(LogLevel.WARN, message, context);
    console.warn(
      `%c[WARN] %c[${new Date().toLocaleTimeString()}] %c${message}`,
      "color: #f59e0b; font-weight: bold;",
      "color: #64748b;",
      "color: #f59e0b;",
      context !== undefined ? context : ""
    );
  }

  error(message: string, context?: any) {
    this.formatLog(LogLevel.ERROR, message, context);
    console.error(
      `%c[ERROR] %c[${new Date().toLocaleTimeString()}] %c${message}`,
      "color: #ef4444; font-weight: bold;",
      "color: #64748b;",
      "color: #ef4444; font-weight: bold;",
      context !== undefined ? context : ""
    );
  }

  fatal(message: string, context?: any) {
    this.formatLog(LogLevel.FATAL, message, context);
    console.error(
      `%c[FATAL] %c[${new Date().toLocaleTimeString()}] %c${message}`,
      "background: #ef4444; color: white; font-weight: bold; padding: 1px 4px; border-radius: 3px;",
      "color: #64748b;",
      "color: #ef4444; font-weight: bold; text-decoration: underline;",
      context !== undefined ? context : ""
    );
  }

  getLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  clearLogs() {
    this.logBuffer = [];
  }
}

export const logger = new StructuredLogger();
export default logger;
