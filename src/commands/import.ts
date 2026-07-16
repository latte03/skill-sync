/**
 * import 命令 — 导入散落 skill 到中央仓库
 *
 * 参考 PRD §7 import 命令规范
 *
 * 用法：
 *   skill-sync import <path> [options]
 *
 * 选项：
 *   -a, --agents <list>     导入后分发到指定 Agent
 *   --deploy <type>         部署方式: symlink | copy
 *   --no-deploy             只导入到中央仓库，不自动分发
 *   -y, --yes               跳过确认提示
 */

import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { createContext } from '../core/context.js';
import { importSkill, deploySkill } from '../core/skill-manager.js';
import { discoverLocalSkills } from '../core/installer.js';
import { detectInstalledAgents, getAgentDisplayName } from '../lib/agents.js';
import type { ScannedSkill, UserDeployMode } from '../lib/types.js';

export function importCommand(inputPath: string | undefined, opts: {
  agents?: string;
  deploy?: UserDeployMode;
  noDeploy?: boolean;
  yes?: boolean;
}): void {
  if (!inputPath) {
    console.error(chalk.red('请指定要导入的 skill 目录路径'));
    process.exit(2);
  }

  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    console.error(chalk.red(`路径不存在: ${resolved}`));
    process.exit(2);
  }

  const ctx = createContext();

  // 发现 skill
  const skills = discoverLocalSkills(resolved);

  if (skills.length === 0) {
    console.error(chalk.red(`未在 ${resolved} 中找到 SKILL.md`));
    process.exit(3);
  }

  console.log(chalk.cyan('\n═══ 导入 Skill ═══\n'));
  console.log(chalk.gray(`  路径: ${resolved}`));
  console.log(chalk.gray(`  发现 ${skills.length} 个 skill:\n`));

  for (const skill of skills) {
    console.log(chalk.gray(`    - ${skill.name}${skill.description ? `: ${skill.description}` : ''}`));
  }
  console.log();

  // 确认
  if (!opts.yes) {
    console.log(chalk.yellow('  使用 -y/--yes 确认导入'));
    return;
  }

  // 解析 agents
  const targetAgents = opts.agents
    ? opts.agents.split(',').map(s => s.trim()).filter(Boolean)
    : detectInstalledAgents();

  let success = 0;
  let failed = 0;

  for (const skill of skills) {
    // 构建 ScannedSkill
    const scanned: ScannedSkill = {
      name: skill.name,
      dir: skill.dir,
      skillMdPath: skill.skillMdPath,
      description: skill.description,
      agentName: '',
      isSymlink: false,
      relativePath: skill.relativePath,
    };

    try {
      const result = importSkill(ctx, scanned, {
        replaceWithLink: false,
        mode: opts.deploy,
      });
      console.log(chalk.green(`  ✓ ${result.name} (v${result.version})`));

      // 分发到 Agent
      if (!opts.noDeploy && targetAgents.length > 0) {
        for (const agent of targetAgents) {
          try {
            deploySkill(ctx, result.name, agent, { mode: opts.deploy, force: true });
            console.log(chalk.gray(`    → ${getAgentDisplayName(agent)}`));
          } catch (e) {
            console.log(chalk.red(`    ✗ ${getAgentDisplayName(agent)}: ${(e as Error).message}`));
          }
        }
      }

      success++;
    } catch (e) {
      console.log(chalk.red(`  ✗ ${skill.name}: ${(e as Error).message}`));
      failed++;
    }
  }

  console.log();
  console.log(chalk.gray(`  成功: ${success}, 失败: ${failed}`));
}
