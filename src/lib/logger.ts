type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  stack?: string;
  source?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private createLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source: this.getCallerInfo()
    };

    if (data !== undefined) {
      entry.data = data;
    }

    if (level === 'error' && data instanceof Error) {
      entry.stack = data.stack;
    }

    return entry;
  }

  private getCallerInfo(): string {
    const stack = new Error().stack;
    if (!stack) return 'unknown';
    
    const lines = stack.split('\n');
    // Skip first 3 lines (Error, getCallerInfo, createLogEntry, actual log method)
    const callerLine = lines[4];
    if (!callerLine) return 'unknown';
    
    // Extract filename and line number
    const match = callerLine.match(/(?:at\s+)?(?:.*?\s+)?\(?([^/\\]*\.tsx?):(\d+):\d+\)?/);
    return match ? `${match[1]}:${match[2]}` : 'unknown';
  }

  private addLog(entry: LogEntry) {
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Also log to browser console for immediate visibility
    const consoleMethod = console[entry.level] || console.log;
    const prefix = `[${entry.level.toUpperCase()}] [${entry.source}]`;
    
    if (entry.data !== undefined) {
      consoleMethod(`${prefix} ${entry.message}`, entry.data);
    } else {
      consoleMethod(`${prefix} ${entry.message}`);
    }
  }

  debug(message: string, data?: any) {
    this.addLog(this.createLogEntry('debug', message, data));
  }

  info(message: string, data?: any) {
    this.addLog(this.createLogEntry('info', message, data));
  }

  warn(message: string, data?: any) {
    this.addLog(this.createLogEntry('warn', message, data));
  }

  error(message: string, data?: any) {
    this.addLog(this.createLogEntry('error', message, data));
  }

  // Get all logs for debugging
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filtered = level ? this.logs.filter(log => log.level === level) : this.logs;
    return limit ? filtered.slice(0, limit) : filtered;
  }

  // Get formatted logs for easy reading
  getFormattedLogs(level?: LogLevel, limit?: number): string {
    return this.getLogs(level, limit)
      .map(log => {
        let formatted = `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`;
        if (log.data !== undefined) {
          formatted += `\nData: ${JSON.stringify(log.data, null, 2)}`;
        }
        if (log.stack) {
          formatted += `\nStack: ${log.stack}`;
        }
        return formatted;
      })
      .join('\n\n');
  }

  // Clear logs
  clear() {
    this.logs = [];
  }

  // Export logs for sharing
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Create global logger instance
export const logger = new Logger();

// Add to window for console access
if (typeof window !== 'undefined') {
  (window as any).salesonatorLogger = logger;
}