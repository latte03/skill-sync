/**
 * 错误处理与退出码体系
 *
 * 参考 PRD §12 错误处理 + AGENT.md §8 退出码
 *
 * 退出码：
 * 0 = 成功
 * 1 = 通用错误
 * 2 = 参数错误
 * 3 = 未初始化
 * 4 = 网络/远程错误
 * 5 = 文件系统错误
 * 6 = 冲突错误
 * 7 = 依赖缺失
 * 8 = 部分失败
 */

export const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidArgs: 2,
  NotInitialized: 3,
  NetworkError: 4,
  FileSystemError: 5,
  Conflict: 6,
  DependencyMissing: 7,
  PartialFailure: 8,
} as const;

/**
 * SkillSync 基础错误类
 */
export class SkillSyncError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number = ExitCode.GeneralError) {
    super(message);
    this.name = 'SkillSyncError';
    this.exitCode = exitCode;
  }
}

/**
 * 参数错误
 */
export class InvalidArgsError extends SkillSyncError {
  constructor(message: string) {
    super(message, ExitCode.InvalidArgs);
    this.name = 'InvalidArgsError';
  }
}

/**
 * 未初始化错误
 */
export class NotInitializedError extends SkillSyncError {
  constructor(message = 'SkillSync 尚未初始化，请先运行 skill-sync init') {
    super(message, ExitCode.NotInitialized);
    this.name = 'NotInitializedError';
  }
}

/**
 * 网络错误
 */
export class NetworkError extends SkillSyncError {
  constructor(message: string) {
    super(message, ExitCode.NetworkError);
    this.name = 'NetworkError';
  }
}

/**
 * 文件系统错误
 */
export class FileSystemError extends SkillSyncError {
  constructor(message: string) {
    super(message, ExitCode.FileSystemError);
    this.name = 'FileSystemError';
  }
}

/**
 * 冲突错误
 */
export class ConflictError extends SkillSyncError {
  constructor(message: string) {
    super(message, ExitCode.Conflict);
    this.name = 'ConflictError';
  }
}

/**
 * 依赖缺失错误
 */
export class DependencyMissingError extends SkillSyncError {
  constructor(message: string) {
    super(message, ExitCode.DependencyMissing);
    this.name = 'DependencyMissingError';
  }
}

/**
 * 部分失败错误
 */
export class PartialFailureError extends SkillSyncError {
  readonly successCount: number;
  readonly failureCount: number;

  constructor(message: string, successCount: number, failureCount: number) {
    super(message, ExitCode.PartialFailure);
    this.name = 'PartialFailureError';
    this.successCount = successCount;
    this.failureCount = failureCount;
  }
}

/**
 * 根据错误类型获取退出码
 */
export function getExitCode(e: unknown): number {
  if (e instanceof SkillSyncError) return e.exitCode;
  return ExitCode.GeneralError;
}

/**
 * 格式化错误消息
 */
export function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
