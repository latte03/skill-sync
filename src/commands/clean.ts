/**
 * clean 命令 — 清理缓存/备份/孤儿文件
 *
 * 参考 PRD §7 clean 命令规范
 *
 * 用法：
 *   skill-sync clean [options]
 *
 * 选项：
 *   --cache           清理缓存目录
 *   --backups <name>  清理指定 skill 的所有备份
 *   --orphans         清理 Agent 目录中不在 manifest 中的 skill（仅删 symlink）
 *   --all             清理以上所有
 *   -f, --force       允许删除真实目录（默认只删 symlink）
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { createContext } from '../core/context.js';
import { cachePath, skillsDirPath, backupDirPath, agentSkillDirPath } from '../lib/paths.js';
import { getAllLockSkillNames } from '../lib/lock.js';
import { readManifest } from '../lib/manifest.js';
import { getAgents } from '../lib/agents.js';
import { handleCommandError } from '../lib/errors.js';
import { listSkills } from '../core/skill-manager.js';

export function cleanCommand(opts: {
  cache?: boolean;
  backups?: string;
  orphans?: boolean;
  all?: boolean;
  force?: boolean;
}): void {
  const ctx = createContext();

  try {
    const doCache = opts.cache || opts.all;
    const doBackups = opts.backups || opts.all;
    const doOrphans = opts.orphans || opts.all;

    if (!doCache && !doBackups && !doOrphans) {
      console.error(chalk.red('\n✗ 请指定清理目标: --cache, --backups <name>, --orphans, --all'));
      process.exit(2);
    }

    let cleaned = 0;

    // 1. 清理缓存
    if (doCache) {
      const cacheDir = cachePath();
      if (fs.existsSync(cacheDir)) {
        const size = getDirSize(cacheDir);
        fs.rmSync(cacheDir, { recursive: true });
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(chalk.green(`  ✓ 清理缓存: ${formatSize(size)}`));
        cleaned++;
      } else {
        console.log(chalk.gray('  - 缓存目录不存在，跳过'));
      }
    }

    // 2. 清理备份
    if (doBackups) {
      if (opts.backups) {
        // 清理指定 skill 的备份
        const name = opts.backups;
        const [namespace, skillName] = name.split('/');
        if (namespace && skillName) {
          const backupDir = backupDirPath(namespace, skillName);
          if (fs.existsSync(backupDir)) {
            const size = getDirSize(backupDir);
            fs.rmSync(backupDir, { recursive: true });
            console.log(chalk.green(`  ✓ 清理 ${name} 的备份: ${formatSize(size)}`));
            cleaned++;
          } else {
            console.log(chalk.gray(`  - ${name} 无备份目录`));
          }
        }
      } else {
        // 清理所有 skill 的备份
        const names = getAllLockSkillNames();
        let totalSize = 0;
        let count = 0;
        for (const name of names) {
          const [ns, sn] = name.split('/');
          if (!ns || !sn) continue;
          const backupDir = backupDirPath(ns, sn);
          if (fs.existsSync(backupDir)) {
            totalSize += getDirSize(backupDir);
            fs.rmSync(backupDir, { recursive: true });
            count++;
          }
        }
        if (count > 0) {
          console.log(chalk.green(`  ✓ 清理 ${count} 个 skill 的备份: ${formatSize(totalSize)}`));
          cleaned++;
        } else {
          console.log(chalk.gray('  - 无备份可清理'));
        }
      }
    }

    // 3. 清理孤儿文件
    if (doOrphans) {
      const managedSkills = new Set<string>();
      const allSkills = listSkills(ctx);
      for (const skill of allSkills) {
        managedSkills.add(skill.skillName);
      }

      const agents = getAgents();
      let orphanCount = 0;

      for (const [agentName, agentConfig] of Object.entries(agents)) {
        const agentSkillDir = agentSkillDirPath(agentConfig.skillsDir);
        if (!fs.existsSync(agentSkillDir)) continue;

        const entries = fs.readdirSync(agentSkillDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
          if (managedSkills.has(entry.name)) continue;

          const fullPath = path.join(agentSkillDir, entry.name);
          const isSymlink = fs.lstatSync(fullPath).isSymbolicLink();

          if (isSymlink) {
            // symlink 直接删
            fs.rmSync(fullPath, { recursive: true });
            console.log(chalk.green(`  ✓ 清理孤儿 symlink: ${agentName}/${entry.name}`));
            orphanCount++;
          } else if (opts.force) {
            // 真实目录需要 --force
            fs.rmSync(fullPath, { recursive: true });
            console.log(chalk.yellow(`  ⚠ 清理孤儿目录: ${agentName}/${entry.name} (--force)`));
            orphanCount++;
          } else {
            console.log(chalk.gray(`  - 跳过孤儿目录: ${agentName}/${entry.name} (使用 --force 删除)`));
          }
        }
      }

      if (orphanCount > 0) {
        cleaned++;
      } else {
        console.log(chalk.gray('  - 无孤儿文件'));
      }
    }

    console.log();
    if (cleaned > 0) {
      console.log(chalk.green('✓ 清理完成'));
    } else {
      console.log(chalk.gray('无需清理'));
    }
  } catch (e) {
    handleCommandError(e);
  }
}

/**
 * 计算目录大小（字节）
 */
function getDirSize(dir: string): number {
  let size = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      size += getDirSize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }
  return size;
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
