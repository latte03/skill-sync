/**
 * update 命令 — 更新 skill（自动备份 + 远程重新下载）
 *
 * 参考 PRD §7 update 命令规范
 *
 * 用法：
 *   skill-sync update [name] [options]
 *
 * 选项：
 *   --version <semver>  指定升级到某个版本
 *   --no-backup         不保留备份
 *   --dry-run           预览将要发生的变化
 *   -f, --force         跳过确认
 */

import chalk from 'chalk';
import { createContext } from '../core/context.js';
import { checkForUpdate, checkAllUpdates, updateSkill, updateAllSkills, listSkillBackups, restoreFromBackup } from '../core/version-manager.js';
import { getExitCode, PartialFailureError, handleCommandError } from '../lib/errors.js';

export async function updateCommand(name: string | undefined, opts: {
  all?: boolean;
  version?: string;
  noBackup?: boolean;
  backup?: boolean;
  dryRun?: boolean;
  force?: boolean;
}): Promise<void> {
  const ctx = createContext();
  const noBackup = opts.backup === false;

  // 确认
  if (!opts.force && !opts.dryRun) {
    if (name) {
      console.log(chalk.yellow(`  ⚠ 将更新 ${name}（使用 -f/--force 确认）`));
      return;
    } else {
      console.log(chalk.yellow('  ⚠ 将更新所有有更新的 skill（使用 -f/--force 确认）'));
      return;
    }
  }

  try {
    if (name) {
      // 更新单个 skill
      console.log(chalk.cyan('\n═══ 检查更新 ═══\n'));

      const check = await checkForUpdate(ctx, name);

      if (!check.hasUpdate && !check.isLocal) {
        console.log(chalk.green(`  ✓ ${name}  ${check.currentVersion}  (已是最新)`));
        return;
      }

      if (check.isLocal) {
        console.log(chalk.gray(`  - ${name}  ${check.currentVersion}  (本地 skill，无远程源)`));
        return;
      }

      console.log(chalk.blue(`  ↑ ${name}  ${check.currentVersion} → latest\n`));

      const result = await updateSkill(ctx, name, {
        noBackup,
        dryRun: opts.dryRun,
        force: opts.force,
      });

      if (result.success) {
        console.log(chalk.green(`  ✓ ${result.name}  ${result.oldVersion} → ${result.newVersion}`));
        if (result.backupDir) {
          console.log(chalk.gray(`    备份: ${result.backupDir}`));
        }
      } else {
        console.log(chalk.red(`  ✗ ${result.name}: ${result.error}`));
        process.exit(getExitCode(new Error(result.error)));
      }
    } else {
      // 更新所有有更新的 skill
      console.log(chalk.cyan('\n═══ 检查更新 ═══\n'));

      const checks = await checkAllUpdates(ctx);
      const toUpdate = checks.filter(c => c.hasUpdate);

      // 显示检查结果
      for (const check of checks) {
        if (check.isLocal) {
          console.log(chalk.gray(`  - ${check.name.padEnd(40)} ${check.currentVersion}  (本地，无远程)`));
        } else if (check.hasUpdate) {
          console.log(chalk.blue(`  ↑ ${check.name.padEnd(40)} ${check.currentVersion} → latest`));
        } else {
          console.log(chalk.green(`  ✓ ${check.name.padEnd(40)} ${check.currentVersion}  (已是最新)`));
        }
      }

      if (toUpdate.length === 0) {
        console.log(chalk.green('\n  所有 skill 均为最新版本'));
        return;
      }

      console.log(chalk.cyan(`\n  ${toUpdate.length} 个 skill 可更新\n`));

      if (opts.dryRun) {
        console.log(chalk.yellow('  [dry-run 模式，不会实际执行]'));
        return;
      }

      // 逐个更新
      const results = await updateAllSkills(ctx, { noBackup, dryRun: opts.dryRun, force: opts.force });

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log();
      for (const result of results) {
        if (result.success) {
          console.log(chalk.green(`  ✓ ${result.name}  ${result.oldVersion} → ${result.newVersion}`));
          if (result.backupDir) {
            console.log(chalk.gray(`    备份: ${result.backupDir}`));
          }
        } else {
          console.log(chalk.red(`  ✗ ${result.name}: ${result.error}`));
        }
      }

      console.log(chalk.cyan(`\n  成功: ${successCount}, 失败: ${failureCount}`));

      if (failureCount > 0 && successCount > 0) {
        process.exit(getExitCode(new PartialFailureError('部分更新失败', successCount, failureCount)));
      } else if (failureCount > 0) {
        process.exit(1);
      }
    }
  } catch (e) {
    handleCommandError(e);
  }
}

/**
 * switch 命令 — 从备份恢复版本
 *
 * 用法：
 *   skill-sync switch <name> [options]
 *
 * 选项：
 *   --list        列出可用备份
 *   --backup <id> 指定恢复的备份 ID
 *   -f, --force   跳过确认
 */
export function switchCommand(name: string, opts: {
  list?: boolean;
  backup?: string;
  force?: boolean;
}): void {
  const ctx = createContext();

  if (opts.list) {
    // 列出备份
    const backups = listSkillBackups(name);
    if (backups.length === 0) {
      console.log(chalk.gray(`  ${name} 无可用备份`));
      return;
    }

    console.log(chalk.cyan(`\n═══ ${name} 的备份 ═══\n`));
    for (const b of backups) {
      console.log(chalk.gray(`  ${b.id}.  v${b.version}  (${b.timestamp})`));
    }
    return;
  }

  // 恢复
  if (!opts.force) {
    console.log(chalk.yellow(`  ⚠ 将恢复 ${name}（使用 -f/--force 确认）`));
    return;
  }

  try {
    const backupId = opts.backup ? parseInt(opts.backup, 10) : undefined;
    const result = restoreFromBackup(ctx, name, backupId);

    console.log(chalk.green(`\n✓ 已恢复 ${name} → v${result.version}`));
    console.log(chalk.gray(`  备份来源: ${result.backupDir}`));
    console.log(chalk.gray('\n  注意: 恢复后需手动重新 deploy'));
  } catch (e) {
    handleCommandError(e);
  }
}
