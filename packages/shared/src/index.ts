/**
 * @stora/shared
 *
 * Shared utilities and types for Stora packages.
 */

import chalk from 'chalk';

// ============================================================================
// Logger
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  silent?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private silent: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.prefix = options.prefix ?? '';
    this.silent = options.silent ?? false;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.silent) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(message: string): string {
    return this.prefix ? `${this.prefix} ${message}` : message;
  }

  debug(message: string): void {
    if (this.shouldLog('debug')) {
      console.log(chalk.gray(this.formatMessage(message)));
    }
  }

  info(message: string): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage(message));
    }
  }

  success(message: string): void {
    if (this.shouldLog('info')) {
      console.log(chalk.green(this.formatMessage(`✓ ${message}`)));
    }
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) {
      console.log(chalk.yellow(this.formatMessage(`⚠ ${message}`)));
    }
  }

  error(message: string): void {
    if (this.shouldLog('error')) {
      console.error(chalk.red(this.formatMessage(`✗ ${message}`)));
    }
  }

  step(number: number, total: number, message: string): void {
    if (this.shouldLog('info')) {
      console.log(chalk.cyan(`[${number}/${total}]`), this.formatMessage(message));
    }
  }
}

// ============================================================================
// Errors
// ============================================================================

export class StoraError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StoraError';
  }
}

export class ConfigError extends StoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends StoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class APIError extends StoraError {
  constructor(
    message: string,
    public statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 'API_ERROR', details);
    this.name = 'APIError';
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, backoff = 2, onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        onRetry?.(lastError, attempt);
        await sleep(delay * Math.pow(backoff, attempt - 1));
      }
    }
  }

  throw lastError;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

// ============================================================================
// Types
// ============================================================================

export type Platform = 'ios' | 'android' | 'both';

export type Framework = 'react-native' | 'flutter' | 'native-ios' | 'native-android' | 'unknown';

export interface AppInfo {
  name: string;
  version: string;
  bundleId?: string;
  packageName?: string;
  platform: Platform;
  framework: Framework;
}
