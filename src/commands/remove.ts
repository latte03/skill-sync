/**
 * remove 命令 — 删除 skill
 *
 * 参考 PRD §7 remove 命令规范
 *
 * 用法：
 *   skill-sync remove <name> [options]
 *
 * 选项：
 *   --all       删除中央仓库 + 所有 Agent 下的分发
 *   --central   仅删除中央仓库（Agent 下的分发变为孤儿副本）
 *   --agent <n> 仅删除某个 Agent 下的分发
 *   -f, --force 跳过确认
 */

import chalk from 'chalk';
import { createContext } from '../core/context.js';
import { removeSkill, getSkillDetail } from '../core/skill-manager.js';
import { getAgentDisplayName } from '../lib/agents.js';
import { handleCommandError } from '../lib/errors.js';
import type { RemoveScope } from '../lib/types.js';

export function removeCommand(name: string, opts: {
  all?: boolean;
  central?: boolean;
  agent?: string;
  force?: boolean;
}): void {
  const ctx = createContext();

  // 检查 skill 是否存在
  const skill = getSkillDetail(ctx, name);
  if (!skill) {
    console.error(chalk.red(`✗ Skill 未找到: ${name}`));
    process.exit(3);
  }

  // 确定删除范围
  let scope: RemoveScope = 'all';
  if (opts.central) scope = 'central';
  else if (opts.agent) scope = 'agent';

  // 显示将要执行的操作
  console.log(chalk.cyan('\n═══ 删除 Skill ═══\n'));
  console.log(chalk.gray(`  Skill: ${skill.name} (v${skill.version})`));

  if (scope === 'all') {
    console.log(chalk.gray(`  范围: 中央仓库 + 所有 Agent 分发`));
    if (skill.agents.length > 0) {
      console.log(chalk.gray(`  受影响 Agent: ${skill.agents.map(a => getAgentDisplayName(a)).join(', ')}`));
    }
  } else if (scope === 'central') {
    console.log(chalk.gray(`  范围: 仅中央仓库（Agent 分发变为孤儿副本）`));
  } else if (scope === 'agent' && opts.agent) {
    console.log(chalk.gray(`  范围: 仅从 ${getAgentDisplayName(opts.agent)} 移除`));
  }

  console.log();

  // 确认
  if (!opts.force) {
    // TODO: 使用 inquirer 确认
    console.log(chalk.yellow('  ⚠ 此操作不可逆（使用 -f/--force 跳过确认）'));
    return;
  }

  // 执行删除
  try {
    removeSkill(ctx, name, scope, opts.agent);
    console.log(chalk.green(`\n✓ 已删除: ${name}`));

    if (scope === 'central') {
      console.log(chalk.gray('  Agent 下的分发已变为孤儿副本'));
    }
  } catch (e) {
    handleCommandError(e);
  }
}
