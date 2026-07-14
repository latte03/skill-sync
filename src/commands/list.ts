/**
 * list 命令 — 列出所有已管理的 skill
 */

import chalk from 'chalk';
import { listSkills } from '../core/skill-manager.js';
import { createContext } from '../core/context.js';
import { getAgentDisplayName } from '../lib/agents.js';
import type { SkillFilter } from '../lib/types.js';

export function listCommand(filter?: SkillFilter): void {
  const ctx = createContext();
  let skills = listSkills(ctx);

  // 应用过滤
  if (filter?.agent) {
    skills = skills.filter(s => s.agents.includes(filter.agent!));
  }
  if (filter?.tag) {
    skills = skills.filter(s => s.tags.includes(filter.tag!));
  }

  if (skills.length === 0) {
    console.log(chalk.gray('暂无已管理的 skill'));
    console.log(chalk.gray('使用 `skill-sync add <github-url>` 添加 skill'));
    return;
  }

  // 表格输出
  console.log(chalk.cyan(`\n已管理 Skill (${skills.length})\n`));
  console.log(
    chalk.gray(
      'Name'.padEnd(40) +
      'Version'.padEnd(12) +
      'Agents'.padEnd(30) +
      'Mode'
    )
  );
  console.log(chalk.gray('─'.repeat(90)));

  for (const skill of skills) {
    const agentStr = skill.agents.length > 0
      ? skill.agents.map(a => getAgentDisplayName(a)).join(', ')
      : chalk.gray('未分发');

    console.log(
      skill.name.padEnd(40) +
      skill.version.padEnd(12) +
      agentStr.padEnd(30) +
      skill.deployMode
    );
  }
  console.log();
}
