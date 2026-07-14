/**
 * SkillSyncContext — 上下文依赖注入
 *
 * 参考 PRD §4.4 核心架构设计
 *
 * 所有核心 API 接收 context 对象，不直接访问全局状态。
 * 测试时传入 mock context，实现完全隔离。
 */

import type { Config } from '../lib/types.js';
import type { Logger } from '../lib/logger.js';
import { ConsoleLogger, SilentLogger } from '../lib/logger.js';
import { readConfig, isInitialized } from '../config.js';
import { getHomeDir } from '../lib/paths.js';

export interface SkillSyncContext {
  /** 中央仓库根目录 */
  homeDir: string;
  /** 配置对象 */
  config: Config;
  /** 日志器 */
  logger: Logger;
  /** 是否为 dry-run 模式 */
  dryRun: boolean;
  /** 是否跳过网络请求（测试用） */
  offline: boolean;
}

/**
 * 创建默认 context（从文件系统读取配置）
 */
export function createContext(opts?: {
  dryRun?: boolean;
  offline?: boolean;
  logger?: Logger;
}): SkillSyncContext {
  const config = isInitialized() ? readConfig() : { logLevel: 'info' } as Config;
  const logLevel = config.logLevel ?? 'info';

  return {
    homeDir: getHomeDir(),
    config,
    logger: opts?.logger ?? new ConsoleLogger(logLevel),
    dryRun: opts?.dryRun ?? false,
    offline: opts?.offline ?? false,
  };
}

/**
 * 创建测试 context（使用 SilentLogger，不访问真实文件系统）
 */
export function createTestContext(opts?: {
  homeDir?: string;
  config?: Config;
  dryRun?: boolean;
  offline?: boolean;
}): SkillSyncContext {
  return {
    homeDir: opts?.homeDir ?? '/tmp/skill-sync-test',
    config: opts?.config ?? { logLevel: 'info' } as Config,
    logger: new SilentLogger(),
    dryRun: opts?.dryRun ?? false,
    offline: opts?.offline ?? true,
  };
}
