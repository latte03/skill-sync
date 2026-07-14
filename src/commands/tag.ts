/**
 * tag 命令 — 管理 skill 标签
 *
 * 参考 PRD §7 tag 命令规范
 *
 * 用法：
 *   skill-sync tag add <name> <tag>
 *   skill-sync tag remove <name> <tag>
 *   skill-sync tag list [tag]
 */

import chalk from 'chalk';
import { addTag, removeTag, listAllTags, listSkillsByTag } from '../lib/tags.js';
import { formatError } from '../lib/errors.js';

export function tagCommand(action: string, name: string | undefined, tag: string | undefined): void {
  try {
    switch (action) {
      case 'add': {
        if (!name || !tag) {
          console.error(chalk.red('\n✗ 用法: skill-sync tag add <name> <tag>'));
          process.exit(2);
        }
        addTag(name, tag);
        console.log(chalk.green(`\n✓ 已添加标签 '${tag}' → ${name}`));
        break;
      }

      case 'remove': {
        if (!name || !tag) {
          console.error(chalk.red('\n✗ 用法: skill-sync tag remove <name> <tag>'));
          process.exit(2);
        }
        removeTag(name, tag);
        console.log(chalk.green(`\n✓ 已移除标签 '${tag}' ← ${name}`));
        break;
      }

      case 'list': {
        if (tag) {
          // 列出指定标签下的 skill
          const skills = listSkillsByTag(tag);
          if (skills.length === 0) {
            console.log(chalk.gray(`\n  标签 '${tag}' 下无 skill`));
          } else {
            console.log(chalk.cyan(`\n  标签 '${tag}' (${skills.length} skills)`));
            console.log(chalk.gray('  ' + '─'.repeat(50)));
            for (const s of skills) {
              console.log(`  ${s}`);
            }
          }
        } else {
          // 列出所有标签
          const tags = listAllTags();
          const tagNames = Object.keys(tags);
          if (tagNames.length === 0) {
            console.log(chalk.gray('\n  无标签'));
          } else {
            console.log(chalk.cyan('\n  Tags'));
            console.log(chalk.gray('  ' + '─'.repeat(50)));
            for (const t of tagNames) {
              console.log(`  ${chalk.blue(t.padEnd(20))} ${tags[t]!.length} skill(s)`);
            }
          }
        }
        break;
      }

      default:
        console.error(chalk.red(`\n✗ 未知操作: ${action}`));
        console.error(chalk.gray('  可用操作: add, remove, list'));
        process.exit(2);
    }
  } catch (e) {
    console.error(chalk.red(`\n✗ ${formatError(e)}`));
    process.exit(1);
  }
}
