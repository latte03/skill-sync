/**
 * info 命令 — 查看 skill 详情
 *
 * 参考 PRD §7 info 命令规范
 *
 * 用法：
 *   skill-sync info <name>
 */

import chalk from 'chalk';
import { createContext } from '../core/context.js';
import { getSkillDetail } from '../core/skill-manager.js';
import { listSkillBackups } from '../core/version-manager.js';
import { getLockEntry } from '../lib/lock.js';
import { readManifest } from '../lib/manifest.js';
import { getAgentSkillDir, getAgents } from '../lib/agents.js';
import { formatError } from '../lib/errors.js';
import type { LockEntry } from '../lib/types.js';

export function infoCommand(name: string): void {
  const ctx = createContext();

  try {
    const detail = getSkillDetail(ctx, name);
    if (!detail) {
      console.error(chalk.red(`\n✗ Skill 未找到: ${name}`));
      process.exit(1);
    }

    const entry: LockEntry | null = getLockEntry(name);
    const [namespace, skillName] = name.split('/');

    let manifest = null;
    try {
      manifest = readManifest(namespace, skillName);
    } catch {
      // ignore
    }

    // 基本信息
    console.log(chalk.cyan(`\n  ${name}`));
    console.log(chalk.gray('  ' + '═'.repeat(60)));
    console.log();

    if (manifest?.description) {
      console.log(`  ${chalk.gray('Description:')}  ${manifest.description}`);
    }
    console.log(`  ${chalk.gray('Version:')}      ${detail.version}`);

    if (entry?.source) {
      const sourceStr = entry.source.type === 'github'
        ? `github:${entry.source.repo}${entry.source.path ? '/' + entry.source.path : ''}`
        : 'local';
      console.log(`  ${chalk.gray('Source:')}       ${sourceStr}`);
    }

    if (manifest?.distribution?.mode) {
      console.log(`  ${chalk.gray('Deploy mode:')}  ${manifest.distribution.mode}`);
    }

    if (detail.tags.length > 0) {
      console.log(`  ${chalk.gray('Tags:')}         ${detail.tags.join(', ')}`);
    }

    if (entry?.installedAt) {
      const date = entry.installedAt.split('T')[0];
      console.log(`  ${chalk.gray('Installed:')}    ${date}`);
    }

    if (entry?.updatedAt) {
      const date = entry.updatedAt.split('T')[0];
      console.log(`  ${chalk.gray('Updated:')}      ${date}`);
    }

    // 分发状态
    if (entry?.distribution && Object.keys(entry.distribution).length > 0) {
      console.log();
      console.log(chalk.gray('  Distribution:'));

      const agents = getAgents();
      for (const [agentName, agentConfig] of Object.entries(agents)) {
        const dist = entry.distribution[agentName];
        if (dist) {
          const status = dist.managed ? chalk.green('✓ managed') : chalk.yellow('✗ unmanaged');
          const agentDir = getAgentSkillDir(agentName);
          const modeLabel = dist.mode === 'copy' ? chalk.gray(' (copy)') : '';
          console.log(`    ${agentConfig.name.padEnd(14)} ${status}  -> ${agentDir}${modeLabel}`);
        }
      }
    }

    // 备份
    const backups = listSkillBackups(name);
    if (backups.length > 0) {
      console.log();
      console.log(chalk.gray('  Backups:'));
      for (const b of backups) {
        const date = b.timestamp.split('T')[0] ?? b.timestamp;
        console.log(`    ${date}  v${b.version}`);
      }
    }

    console.log();
  } catch (e) {
    console.error(chalk.red(`\n✗ ${formatError(e)}`));
    process.exit(1);
  }
}
