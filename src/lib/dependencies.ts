/**
 * 依赖管理模块
 *
 * 参考 TeleAgent dependencies.ts。
 *
 * PRD v1.2 中的依赖有两层含义：
 * 1. Skill 间依赖（metadata.depends_on）— 声明式，安装前检查
 * 2. 包管理器依赖（npm/pip）— 安装到 skill 目录的 node_modules/.venv
 *
 * 本模块处理第 2 种。第 1 种在 installer.ts 中检查。
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { SkillDependencies, PackageManager } from './types.js';

/**
 * 判断依赖声明是否为空
 */
export function isEmptyDependencies(deps?: SkillDependencies): boolean {
  if (!deps) return true;
  return Object.values(deps).every(arr => !arr || arr.length === 0);
}

/**
 * 解析依赖声明，返回安全的、去重后的结果
 */
export function sanitizeDependencies(raw?: Record<string, unknown>): SkillDependencies {
  if (!raw) return {};

  const result: SkillDependencies = {};
  const validManagers: PackageManager[] = ['npm', 'pip'];

  for (const mgr of validManagers) {
    const val = raw[mgr];
    if (Array.isArray(val)) {
      const packages = val
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map(v => v.trim());
      result[mgr] = [...new Set(packages)];
    }
  }

  return result;
}

/**
 * 从 frontmatter 提取包依赖声明
 *
 * 支持两种写法：
 * 1. 顶层 dependencies（旧写法）
 * 2. metadata.dependencies（推荐位置）
 */
export function extractPackageDependencies(data: Record<string, unknown>): SkillDependencies {
  // 优先 metadata.dependencies
  const metadata = data.metadata;
  if (metadata && typeof metadata === 'object') {
    const deps = (metadata as Record<string, unknown>).dependencies;
    if (deps && typeof deps === 'object') {
      return sanitizeDependencies(deps as Record<string, unknown>);
    }
  }

  // 回退顶层 dependencies
  if (data.dependencies && typeof data.dependencies === 'object') {
    return sanitizeDependencies(data.dependencies as Record<string, unknown>);
  }

  return {};
}

/**
 * 安装 npm 依赖到 skillDir/node_modules/
 */
function installNpm(skillDir: string, packages: string[]): boolean {
  if (packages.length === 0) return true;

  const cmd = `npm install --prefix "${skillDir}" ${packages.map(p => `"${p}"`).join(' ')}`;

  try {
    execSync(cmd, {
      cwd: skillDir,
      stdio: 'pipe',
      timeout: 120_000,
      env: {
        ...process.env,
        npm_config_yes: 'true',
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 安装 pip 依赖到 skillDir/.venv/
 */
function installPip(skillDir: string, packages: string[]): boolean {
  if (packages.length === 0) return true;

  const venvDir = path.join(skillDir, '.venv');
  const pipBin = process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'pip.exe')
    : path.join(venvDir, 'bin', 'pip');

  // 创建 venv（如果不存在）
  if (!fs.existsSync(pipBin)) {
    try {
      execSync(`python3 -m venv "${venvDir}"`, {
        cwd: skillDir,
        stdio: 'pipe',
        timeout: 60_000,
      });
    } catch {
      return false;
    }
  }

  try {
    execSync(`"${pipBin}" install ${packages.map(p => `"${p}"`).join(' ')}`, {
      cwd: skillDir,
      stdio: 'pipe',
      timeout: 120_000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 安装所有声明的依赖
 *
 * @returns true 表示全部安装成功
 */
export function installDependencies(skillDir: string, deps: SkillDependencies): boolean {
  if (isEmptyDependencies(deps)) return true;

  let allOk = true;

  if (deps.npm && deps.npm.length > 0) {
    if (!installNpm(skillDir, deps.npm)) {
      allOk = false;
    }
  }

  if (deps.pip && deps.pip.length > 0) {
    if (!installPip(skillDir, deps.pip)) {
      allOk = false;
    }
  }

  return allOk;
}

// ==================== Skill 间依赖检查 ====================

/**
 * 检查 skill 间依赖是否满足
 *
 * @param dependsOn skill 声明的依赖列表
 * @param installedSkills 已安装的 skill 名称集合
 * @returns 缺失的依赖列表
 */
export function checkSkillDependencies(
  dependsOn: Array<{ name: string; version: string }>,
  installedSkills: Set<string>,
): string[] {
  const missing: string[] = [];
  for (const dep of dependsOn) {
    if (!installedSkills.has(dep.name)) {
      missing.push(dep.name);
    }
  }
  return missing;
}
