/**
 * sync 命令 — Git 同步
 *
 * 参考 PRD §7 sync 命令规范
 *
 * 用法：
 *   skill-sync sync push [options]
 *   skill-sync sync pull [options]
 *   skill-sync sync status
 */

import chalk from 'chalk';
import { createContext } from '../core/context.js';
import { pushSync, pullSync, getSyncStatus, isGitInitialized } from '../core/sync-manager.js';
import { formatError, getExitCode } from '../lib/errors.js';
import type { ConflictStrategy } from '../lib/types.js';

export async function syncCommand(action: string, opts: {
  message?: string;
  strategy?: string;
  dryRun?: boolean;
}): Promise<void> {
  const ctx = createContext();

  try {
    switch (action) {
      case 'push': {
        const result = await pushSync(ctx, {
          message: opts.message,
          dryRun: opts.dryRun,
        });

        if (result.success) {
          if (result.pushed > 0) {
            console.log(chalk.green(`\n✓ 已推送 ${result.pushed} 个变更`));
          } else {
            console.log(chalk.gray('\n  无变更可推送'));
          }
        } else {
          console.error(chalk.red(`\n✗ 推送失败: ${result.error}`));
          process.exit(1);
        }
        break;
      }

      case 'pull': {
        const strategy = (opts.strategy as ConflictStrategy) ?? 'manual';
        const result = await pullSync(ctx, {
          strategy,
          dryRun: opts.dryRun,
        });

        if (result.success) {
          if (result.pulled > 0) {
            console.log(chalk.green(`\n✓ 已拉取 ${result.pulled} 个变更`));
          } else {
            console.log(chalk.gray('\n  无远程变更'));
          }
        } else if (result.conflicts.length > 0) {
          console.log(chalk.yellow(`\n⚠ 合并冲突 (${result.conflicts.length} 个文件):`));
          for (const f of result.conflicts) {
            console.log(chalk.yellow(`  - ${f}`));
          }
          console.log(chalk.gray('\n  请手动解决冲突后运行: git commit'));
          process.exit(6);
        } else {
          console.error(chalk.red(`\n✗ 拉取失败: ${result.error}`));
          process.exit(1);
        }
        break;
      }

      case 'status': {
        if (!isGitInitialized()) {
          console.log(chalk.gray('\n  Git 仓库未初始化'));
          return;
        }

        const status = await getSyncStatus(ctx);

        console.log(chalk.cyan('\n  Sync Status'));
        console.log(chalk.gray('  ' + '─'.repeat(50)));

        if (!status.isRepo) {
          console.log(chalk.gray('  Git 仓库未初始化'));
          return;
        }

        console.log(`  ${chalk.gray('Remote:')}     ${status.hasRemote ? chalk.green('✓ configured') : chalk.yellow('✗ not configured')}`);
        console.log(`  ${chalk.gray('Ahead:')}      ${status.ahead} commit(s)`);
        console.log(`  ${chalk.gray('Behind:')}     ${status.behind} commit(s)`);

        if (status.uncommittedChanges > 0) {
          console.log(`  ${chalk.gray('Changes:')}    ${status.uncommittedChanges} uncommitted file(s)`);
        } else {
          console.log(`  ${chalk.gray('Changes:')}    ${chalk.green('clean')}`);
        }
        console.log();
        break;
      }

      default:
        console.error(chalk.red(`\n✗ 未知操作: ${action}`));
        console.error(chalk.gray('  可用操作: push, pull, status'));
        process.exit(2);
    }
  } catch (e) {
    console.error(chalk.red(`\n✗ ${formatError(e)}`));
    process.exit(getExitCode(e));
  }
}
