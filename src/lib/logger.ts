/**
 * 日志接口
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  raw(msg: string): void;
}

/**
 * 控制台日志实现
 */
export class ConsoleLogger implements Logger {
  constructor(private level: LogLevel = 'info') {}

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }

  debug(msg: string): void {
    if (this.shouldLog('debug')) {
      console.log(`  ${msg}`);
    }
  }

  info(msg: string): void {
    if (this.shouldLog('info')) {
      console.log(msg);
    }
  }

  warn(msg: string): void {
    if (this.shouldLog('warn')) {
      console.warn(msg);
    }
  }

  error(msg: string): void {
    if (this.shouldLog('error')) {
      console.error(msg);
    }
  }

  raw(msg: string): void {
    console.log(msg);
  }
}

/**
 * 静默日志（不输出任何内容，用于测试）
 */
export class SilentLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  raw(): void {}
}
