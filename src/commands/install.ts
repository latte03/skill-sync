/**
 * install 命令 — 从 GitHub 或本地路径安装 skill
 *
 * 参考 PRD §7 install 命令规范
 *
 * 用法：
 *   skill-sync install <source> [options]
 *
 * <source> 支持：
 *   owner/repo              GitHub 简写
 *   https://github.com/...  完整 URL
 *   ./local-path            本地路径
 */

import chalk from 'chalk';
import ora from 'ora';
import { createContext } from '../core/context.js';
import { installGitHubSkill, installLocalSkill } from '../core/installer.js';
import { parseSource, isLocalSource } from '../lib/source.js';
import { getAgentDisplayName } from '../lib/agents.js';
import { formatError, getExitCode } from '../lib/errors.js';
import type { InstallOpts, UserDeployMode } from '../lib/types.js';

export async function installCommand(source: string, opts: InstallOpts & { deployType?: UserDeployMode }): Promise<void> {
  const ctx = createContext();

  // agents 已在 CLI 层转为数组
  const installOpts: InstallOpts = {
    skill: opts.skill,
    ref: opts.ref,
    agents: opts.agents,
    deployType: opts.deployType,
    noDeploy: opts.noDeploy,
    ignoreDeps: opts.ignoreDeps,
    yes: opts.yes,
  };

  const spinner = ora({
    text: `正在安装 ${source}...`,
    color: 'cyan',
  }).start();

  try {
    let result;

    if (isLocalSource(source)) {
      spinner.text = `从本地路径安装: ${source}`;
      result = installLocalSkill(ctx, source, 'local', installOpts);
    } else {
      const parsed = parseSource(source);
      if (parsed.type === 'github') {
        spinner.text = `从 GitHub 安装: ${parsed.owner}/${parsed.repo}`;
        result = await installGitHubSkill(ctx, source, installOpts);
      } else if (parsed.type === 'git') {
        spinner.fail('暂不支持非 GitHub 的 Git 仓库');
        process.exit(1);
      } else {
        spinner.fail(`不支持的来源类型: ${parsed.type}`);
        process.exit(1);
      }
    }

    spinner.succeed(chalk.green(`✓ 安装成功: ${result.name} (v${result.version})`));

    // 输出详情
    console.log();
    console.log(chalk.gray(`  来源: ${result.source.type === 'github' ? `GitHub ${result.source.repo}` : '本地'}`));
    if (result.source.path) {
      console.log(chalk.gray(`  路径: ${result.source.path}`));
    }

    if (result.deployed.length > 0) {
      console.log(chalk.gray(`  已分发到: ${result.deployed.map(a => getAgentDisplayName(a)).join(', ')}`));
    } else if (!opts.noDeploy) {
      console.log(chalk.gray('  未分发到任何 Agent'));
    }

    console.log();
    console.log(chalk.gray('其他命令：'));
    console.log(chalk.gray('  skill-sync list              # 查看已安装的 skill'));
    console.log(chalk.gray('  skill-sync deploy <name>      # 分发到其他 Agent'));
    console.log(chalk.gray('  skill-sync status             # 查看状态'));
  } catch (e) {
    spinner.fail(chalk.red(`✗ 安装失败: ${formatError(e)}`));
    process.exit(getExitCode(e));
  }
}
