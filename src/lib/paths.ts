/**
 * 路径工具模块
 *
 * 核心设计：支持 SKILL_SYNC_HOME 和 SKILL_SYNC_AGENTS_DIR 环境变量覆盖，
 * 用于测试隔离和灰度验证（禁止动用用户真实 skill 目录）。
 */

import path from 'node:path';
import os from 'node:os';
import { assertCanonicalSkillKey } from './skill-key.js';

/**
 * 获取中央仓库根目录
 *
 * 优先级：--home 参数 > SKILL_SYNC_HOME 环境变量 > ~/.skill-sync/
 */
export function getHomeDir(): string {
  // 环境变量覆盖（测试隔离用）
  const envHome = process.env.SKILL_SYNC_HOME;
  if (envHome) return path.resolve(envHome);

  return path.join(os.homedir(), '.skill-sync');
}

/**
 * 获取 Agent 目录根路径
 *
 * SKILL_SYNC_AGENTS_DIR 环境变量用于测试隔离：
 * 设置后所有 Agent 路径（如 ~/.claude/skills）重定向到 <SKILL_SYNC_AGENTS_DIR>/.claude/skills
 */
export function getAgentsBaseDir(): string {
  const envAgentsDir = process.env.SKILL_SYNC_AGENTS_DIR;
  if (envAgentsDir) return path.resolve(envAgentsDir);

  return os.homedir();
}

/**
 * 获取中央仓库下的子路径
 */
export function homePath(...segments: string[]): string {
  return path.join(getHomeDir(), ...segments);
}

/**
 * 获取 config.yaml 路径
 */
export function configPath(): string {
  return homePath('config.yaml');
}

/**
 * 获取 secrets.yaml 路径
 */
export function secretsPath(): string {
  return homePath('secrets.yaml');
}

/**
 * 获取 skills-lock.json 路径
 */
export function lockPath(): string {
  return homePath('skills-lock.json');
}

/**
 * 获取 tags.yaml 路径
 */
export function tagsPath(): string {
  return homePath('tags.yaml');
}

/**
 * 获取 skills 目录路径
 */
export function skillsDirPath(): string {
  return homePath('skills');
}

/**
 * 获取 cache 目录路径
 */
export function cachePath(): string {
  return homePath('cache');
}

/**
 * 获取 temp 目录路径
 */
export function tempPath(): string {
  return homePath('temp');
}

/**
 * 获取 skill 的中央仓库路径
 *
 * name 是 skill 的完整路径标识（如 `anthropics/pdf-processing` 或 `tdd`），
 * 直接映射为 skills/ 下的目录层级，不解析或拆分 SkillKey。
 *
 * @param name skill 完整名称（如 `anthropics/pdf-processing` 或 `engineering/tdd`）
 * @returns 完整路径，如 ~/.skill-sync/skills/anthropics/pdf-processing/
 */
export function skillRepoPath(name: string): string {
  return homePath('skills', assertCanonicalSkillKey(name));
}

/**
 * 获取 skill 的 manifest.yaml 路径
 */
export function manifestPath(name: string): string {
  return path.join(skillRepoPath(name), 'manifest.yaml');
}

/**
 * 获取 skill 的 SKILL.md 路径
 */
export function skillMdPath(name: string): string {
  return path.join(skillRepoPath(name), 'SKILL.md');
}

/**
 * 获取 skill 的 .backup 目录路径
 */
export function backupDirPath(name: string): string {
  return path.join(skillRepoPath(name), '.backup');
}

/**
 * 获取 Agent 的 skill 目录路径
 *
 * @param agentSkillDir Agent 的 skill 目录相对路径（如 .claude/skills）
 * @returns 绝对路径，受 SKILL_SYNC_AGENTS_DIR 影响
 */
export function agentSkillDirPath(agentSkillDir: string): string {
  const base = getAgentsBaseDir();
  // 如果 agentSkillDir 是绝对路径，直接返回
  if (path.isAbsolute(agentSkillDir)) {
    return agentSkillDir;
  }
  return path.join(base, agentSkillDir);
}
