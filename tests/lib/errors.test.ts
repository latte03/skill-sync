/**
 * errors.ts 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  ExitCode,
  SkillSyncError,
  InvalidArgsError,
  NotInitializedError,
  NetworkError,
  FileSystemError,
  ConflictError,
  DependencyMissingError,
  PartialFailureError,
  getExitCode,
  formatError,
} from '../../src/lib/errors.js';

describe('ExitCode', () => {
  it('定义了所有退出码', () => {
    expect(ExitCode.Success).toBe(0);
    expect(ExitCode.GeneralError).toBe(1);
    expect(ExitCode.InvalidArgs).toBe(2);
    expect(ExitCode.NotInitialized).toBe(3);
    expect(ExitCode.NetworkError).toBe(4);
    expect(ExitCode.FileSystemError).toBe(5);
    expect(ExitCode.Conflict).toBe(6);
    expect(ExitCode.DependencyMissing).toBe(7);
    expect(ExitCode.PartialFailure).toBe(8);
  });
});

describe('SkillSyncError', () => {
  it('默认退出码为 GeneralError', () => {
    const e = new SkillSyncError('test');
    expect(e.exitCode).toBe(ExitCode.GeneralError);
    expect(e.message).toBe('test');
    expect(e.name).toBe('SkillSyncError');
  });

  it('可指定退出码', () => {
    const e = new SkillSyncError('test', ExitCode.NetworkError);
    expect(e.exitCode).toBe(ExitCode.NetworkError);
  });
});

describe('InvalidArgsError', () => {
  it('退出码为 InvalidArgs', () => {
    const e = new InvalidArgsError('bad args');
    expect(e.exitCode).toBe(ExitCode.InvalidArgs);
    expect(e.name).toBe('InvalidArgsError');
  });
});

describe('NotInitializedError', () => {
  it('退出码为 NotInitialized', () => {
    const e = new NotInitializedError();
    expect(e.exitCode).toBe(ExitCode.NotInitialized);
    expect(e.message).toContain('init');
  });

  it('可自定义消息', () => {
    const e = new NotInitializedError('custom');
    expect(e.message).toBe('custom');
  });
});

describe('NetworkError', () => {
  it('退出码为 NetworkError', () => {
    const e = new NetworkError('timeout');
    expect(e.exitCode).toBe(ExitCode.NetworkError);
  });
});

describe('FileSystemError', () => {
  it('退出码为 FileSystemError', () => {
    const e = new FileSystemError('permission denied');
    expect(e.exitCode).toBe(ExitCode.FileSystemError);
  });
});

describe('ConflictError', () => {
  it('退出码为 Conflict', () => {
    const e = new ConflictError('skill already exists');
    expect(e.exitCode).toBe(ExitCode.Conflict);
  });
});

describe('DependencyMissingError', () => {
  it('退出码为 DependencyMissing', () => {
    const e = new DependencyMissingError('missing dep');
    expect(e.exitCode).toBe(ExitCode.DependencyMissing);
  });
});

describe('PartialFailureError', () => {
  it('退出码为 PartialFailure', () => {
    const e = new PartialFailureError('partial', 3, 2);
    expect(e.exitCode).toBe(ExitCode.PartialFailure);
    expect(e.successCount).toBe(3);
    expect(e.failureCount).toBe(2);
  });
});

describe('getExitCode', () => {
  it('从 SkillSyncError 获取退出码', () => {
    expect(getExitCode(new NetworkError('test'))).toBe(ExitCode.NetworkError);
  });

  it('从普通 Error 获取默认退出码', () => {
    expect(getExitCode(new Error('test'))).toBe(ExitCode.GeneralError);
  });

  it('从非 Error 值获取默认退出码', () => {
    expect(getExitCode('string error')).toBe(ExitCode.GeneralError);
    expect(getExitCode(null)).toBe(ExitCode.GeneralError);
  });
});

describe('formatError', () => {
  it('格式化 Error 消息', () => {
    expect(formatError(new Error('test message'))).toBe('test message');
  });

  it('格式化非 Error 值', () => {
    expect(formatError('string')).toBe('string');
    expect(formatError(42)).toBe('42');
  });
});
