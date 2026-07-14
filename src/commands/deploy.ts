/**
 * deploy / undeploy 命令 — 分发/取消分发 skill 到 Agent
 *
 * 参考 PRD §7 deploy / undeploy 命令规范
 */

import chalk from 'chalk';
import { createContext } from '../core/context.js';
import { deploySkill, undeploySkill, getSkillDetail, listSkills } from '../core/skill-manager.js';
import { detectInstalledAgents, getAgentDisplayName, getSupportedAgents } from '../lib/agents.js';
import type { UserDeployMode } from '../lib/types.js';

// ==================== deploy ====================

export function deployCommand(name: string | undefined, opts: {
  to?: string;
  all?: boolean;
  mode?: UserDeployMode;
  force?: boolean;
  dryRun?: boolean;
}): void {
  const ctx = createContext();

  // 确定要分发的 skill 列表
  let skillNames: string[] = [];
  if (name) {
    // 单个 skill
    const skill = getSkillDetail(ctx, name);
    if (!skill) {
      console.error(chalk.red(`✗ Skill 未找到: ${name}`));
      process.exit(3);
    }
    skillNames = [name];
  } else if (opts.all) {
    // 所有 skill
    skillNames = listSkills(ctx).map(s => s.name);
    if (skillNames.length === 0) {
      console.log(chalk.gray('暂无已管理的 skill'));
      return;
    }
  } else {
    console.error(chalk.red('请指定 skill 名称或使用 --all'));
    process.exit(2);
  }

  // 确定目标 Agent 列表
  let targetAgents: string[];
  if (opts.to) {
    targetAgents = opts.to.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    targetAgents = detectInstalledAgents();
  }

  // 验证 Agent 名称
  const supported = new Set(getSupportedAgents());
  for (const agent of targetAgents) {
    if (!supported.has(agent)) {
      console.error(chalk.red(`✗ 未知 Agent: ${agent}`));
      console.error(chalk.gray(`  支持: ${getSupportedAgents().join(', ')}`));
      process.exit(4);
    }
  }

  console.log(chalk.cyan('\n═══ 分发 Skill ═══\n'));

  if (opts.dryRun) {
    console.log(chalk.yellow('[dry-run 模式，不会实际执行]\n'));
  }

  let success = 0;
  let failed = 0;

  for (const skillName of skillNames) {
    console.log(chalk.blue(`▸ ${skillName}`));

    for (const agent of targetAgents) {
      try {
        if (opts.dryRun) {
          console.log(chalk.gray(`  → ${getAgentDisplayName(agent)} [dry-run]`));
        } else {
          deploySkill(ctx, skillName, agent, { mode: opts.mode, force: opts.force });
          console.log(chalk.green(`  ✓ ${getAgentDisplayName(agent)}`));
        }
        success++;
      } catch (e) {
        console.log(chalk.red(`  ✗ ${getAgentDisplayName(agent)}: ${(e as Error).message}`));
        failed++;
      }
    }
  }

  console.log();
  if (success > 0) console.log(chalk.green(`✓ 成功: ${success}`));
  if (failed > 0) console.log(chalk.red(`✗ 失败: ${failed}`));
}

// ==================== undeploy ====================

export function undeployCommand(name: string, opts: {
  agent?: string;
  all?: boolean;
  force?: boolean;
}): void {
  const ctx = createContext();

  const skill = getSkillDetail(ctx, name);
  if (!skill) {
    console.error(chalk.red(`✗ Skill 未找到: ${name}`));
    process.exit(3);
  }

  // 确定目标 Agent 列表
  let targetAgents: string[];
  if (opts.all) {
    targetAgents = skill.agents;
  } else if (opts.agent) {
    targetAgents = opts.agent.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    console.error(chalk.red('请指定 --agent <name> 或 --all'));
    process.exit(2);
  }

  if (targetAgents.length === 0) {
    console.log(chalk.gray(`  ${name} 未分发到任何 Agent`));
    return;
  }

  console.log(chalk.cyan('\n═══ 取消分发 ═══\n'));
  console.log(chalk.gray(`  Skill: ${name}`));
  console.log(chalk.gray(`  Agent: ${targetAgents.map(a => getAgentDisplayName(a)).join(', ')}`));
  console.log();

  // 确认
  if (!opts.force) {
    console.log(chalk.yellow('  ⚠ 取消分发后 Agent 下的文件变为副本（使用 -f/--force 确认）'));
    return;
  }

  let success = 0;
  let failed = 0;

  for (const agent of targetAgents) {
    try {
      undeploySkill(ctx, name, agent);
      console.log(chalk.green(`  ✓ ${getAgentDisplayName(agent)}`));
      success++;
    } catch (e) {
      console.log(chalk.red(`  ✗ ${getAgentDisplayName(agent)}: ${(e as Error).message}`));
      failed++;
    }
  }

  console.log();
  if (success > 0) console.log(chalk.green(`✓ 成功: ${success}`));
  if (failed > 0) console.log(chalk.red(`✗ 失败: ${failed}`));
}
