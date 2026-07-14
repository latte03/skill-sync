/**
 * status 命令 — 查看 SkillSync 状态
 */

import chalk from 'chalk';
import fs from 'node:fs';
import { createContext } from '../core/context.js';
import { listSkills } from '../core/skill-manager.js';
import { getHomeDir, configPath, lockPath } from '../lib/paths.js';
import { detectInstalledAgents, getAgentDisplayName, getAgents, getAgentSkillDir } from '../lib/agents.js';
import { readLock } from '../lib/lock.js';
import { isInitialized } from '../config.js';

export function statusCommand(): void {
  const homeDir = getHomeDir();

  console.log(chalk.cyan('\n═══ SkillSync 状态 ═══\n'));

  // 检查初始化状态
  if (!isInitialized()) {
    console.log(chalk.red('✗ SkillSync 尚未初始化'));
    console.log(chalk.gray('  运行 `skill-sync init` 开始使用'));
    return;
  }

  console.log(chalk.blue('▸ 仓库信息'));
  console.log(chalk.gray(`  路径: ${homeDir}`));
  console.log(chalk.gray(`  配置: ${configPath()}`));
  console.log(chalk.gray(`  锁文件: ${lockPath()}`));
  console.log();

  // Skill 统计
  const ctx = createContext();
  const skills = listSkills(ctx);
  const lock = readLock();
  const managedCount = skills.length;
  const distributedCount = skills.filter(s => s.agents.length > 0).length;
  const undistributedCount = managedCount - distributedCount;

  console.log(chalk.blue('▸ Skill 统计'));
  console.log(chalk.gray(`  已管理: ${managedCount}`));
  console.log(chalk.gray(`  已分发: ${distributedCount}`));
  console.log(chalk.gray(`  未分发: ${undistributedCount}`));
  console.log();

  // Agent 状态
  console.log(chalk.blue('▸ Agent 状态'));
  const installed = detectInstalledAgents();
  const allAgents = getAgents();

  for (const agentName of Object.keys(allAgents)) {
    const isInstalled = installed.includes(agentName);
    const status = isInstalled ? chalk.green('✓') : chalk.gray('○');
    const displayName = getAgentDisplayName(agentName);

    // 统计该 Agent 下的 managed skill 数量
    let agentManaged = 0;
    for (const skill of skills) {
      if (skill.agents.includes(agentName)) agentManaged++;
    }

    const skillDir = getAgentSkillDir(agentName);
    const dirExists = fs.existsSync(skillDir);

    console.log(
      `  ${status} ${displayName.padEnd(20)} ${chalk.gray(agentName.padEnd(15))} ` +
      chalk.gray(`managed: ${agentManaged}`) +
      (dirExists ? '' : chalk.gray(' (skill 目录不存在)'))
    );
  }
  console.log();

  // Git 状态（如果存在）
  const gitDir = homeDir + '/.git';
  if (fs.existsSync(gitDir)) {
    console.log(chalk.blue('▸ Git 同步'));
    console.log(chalk.gray('  仓库已初始化'));
    // TODO: 检查 remote、ahead/behind
    console.log();
  }

  // 警告
  const warnings: string[] = [];
  if (managedCount === 0) {
    warnings.push('尚未添加任何 skill，使用 `skill-sync add <github-url>` 添加');
  }
  if (undistributedCount > 0) {
    warnings.push(`${undistributedCount} 个 skill 未分发到任何 Agent`);
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow('▸ 警告'));
    for (const w of warnings) {
      console.log(chalk.yellow(`  ⚠ ${w}`));
    }
    console.log();
  }

  console.log(chalk.green('✓ 状态正常\n'));
}
