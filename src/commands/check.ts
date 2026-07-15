/**
 * check 命令 — 检查 skill 更新
 *
 * 参考 PRD §7 check 命令规范
 *
 * 用法：
 *   skill-sync check [name]
 */

import chalk from 'chalk';
import { createContext } from '../core/context.js';
import { checkForUpdate, checkAllUpdates } from '../core/version-manager.js';
import { handleCommandError } from '../lib/errors.js';

export async function checkCommand(name: string | undefined): Promise<void> {
  const ctx = createContext();

  try {
    console.log(chalk.cyan('\n  Checking for updates...'));
    console.log(chalk.gray('  ' + '═'.repeat(60) + '\n'));

    if (name) {
      const result = await checkForUpdate(ctx, name);

      if (result.isLocal) {
        console.log(chalk.gray(`  -  ${result.name.padEnd(40)} ${result.currentVersion}  (local, no remote)`));
      } else if (result.hasUpdate) {
        console.log(chalk.blue(`  ↑  ${result.name.padEnd(40)} ${result.currentVersion} → ${result.remoteVersion}`));
      } else {
        console.log(chalk.green(`  ✓  ${result.name.padEnd(40)} ${result.currentVersion}  (up to date)`));
      }
    } else {
      const results = await checkAllUpdates(ctx);

      let updateCount = 0;
      for (const result of results) {
        if (result.isLocal) {
          console.log(chalk.gray(`  -  ${result.name.padEnd(40)} ${result.currentVersion}  (local, no remote)`));
        } else if (result.hasUpdate) {
          updateCount++;
          console.log(chalk.blue(`  ↑  ${result.name.padEnd(40)} ${result.currentVersion} → ${result.remoteVersion}  (update available)`));
        } else {
          console.log(chalk.green(`  ✓  ${result.name.padEnd(40)} ${result.currentVersion}  (up to date)`));
        }
      }

      console.log();
      if (updateCount > 0) {
        console.log(chalk.yellow(`  ${updateCount} update(s) available. Run 'skill-sync update' to update.`));
      } else {
        console.log(chalk.green('  All skills are up to date.'));
      }
    }
  } catch (e) {
    handleCommandError(e);
  }
}
