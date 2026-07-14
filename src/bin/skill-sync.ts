#!/usr/bin/env node

/**
 * SkillSync CLI 入口
 *
 * 参考 PRD §7 CLI 命令规范
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { CLI_VERSION } from '../lib/constants.js';
import { initCommand } from '../commands/init.js';
import { listCommand } from '../commands/list.js';
import { statusCommand } from '../commands/status.js';

const program = new Command();

program
  .name('skill-sync')
  .description('跨端跨 Agent 的 AI Skill 统一管理工具')
  .version(CLI_VERSION);

// ─── init ────────────────────────────────────────
program
  .command('init')
  .description('初始化 SkillSync 中央仓库')
  .option('--git', '初始化 Git 仓库')
  .option('--scan', '扫描并导入散落 skill')
  .option('--link', '导入时替换原位置为 symlink')
  .option('--namespace <name>', '导入散落 skill 的命名空间', 'local')
  .option('-y, --yes', '跳过交互提示')
  .action(async (opts) => {
    try {
      await initCommand(opts);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── list ────────────────────────────────────────
program
  .command('list')
  .alias('ls')
  .description('列出所有已管理的 skill')
  .option('--agent <name>', '按 Agent 过滤')
  .option('--tag <tag>', '按标签过滤')
  .action((opts) => {
    try {
      listCommand({
        agent: opts.agent,
        tag: opts.tag,
      });
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── status ──────────────────────────────────────
program
  .command('status')
  .alias('st')
  .description('查看 SkillSync 状态')
  .action(() => {
    try {
      statusCommand();
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── TODO: add ───────────────────────────────────
program
  .command('add <source>')
  .description('从 GitHub 仓库添加 skill')
  .option('-s, --skill <name>', '指定 skill 名称')
  .option('-a, --agents <agents>', '目标 Agent（逗号分隔）')
  .option('--ref <ref>', 'Git 引用（branch/tag/commit）')
  .option('--copy', '使用复制模式（默认 symlink）')
  .option('--no-deploy', '仅添加到中央仓库，不分发')
  .option('--ignore-deps', '跳过依赖检查')
  .option('-y, --yes', '跳过交互提示')
  .action((_source: string, _opts: unknown) => {
    console.log(chalk.yellow('⚠ add 命令尚未实现，将在后续阶段开发'));
  });

// ─── TODO: install ───────────────────────────────
program
  .command('install <query>')
  .description('从 skills.sh 搜索并安装 skill')
  .option('-a, --agents <agents>', '目标 Agent（逗号分隔）')
  .option('--copy', '使用复制模式')
  .option('-y, --yes', '跳过交互提示')
  .action((_query: string, _opts: unknown) => {
    console.log(chalk.yellow('⚠ install 命令尚未实现，将在后续阶段开发'));
  });

// ─── TODO: update ────────────────────────────────
program
  .command('update [name]')
  .description('更新 skill')
  .option('--all', '更新所有 skill')
  .option('--version <ver>', '指定版本')
  .option('--no-backup', '跳过备份')
  .option('--dry-run', '预览更新')
  .action((_name: string | undefined, _opts: unknown) => {
    console.log(chalk.yellow('⚠ update 命令尚未实现，将在后续阶段开发'));
  });

// ─── TODO: remove ────────────────────────────────
program
  .command('remove <name>')
  .alias('rm')
  .description('删除 skill')
  .option('--central', '仅从中央仓库删除')
  .option('--agent <name>', '仅从指定 Agent 删除')
  .option('-y, --yes', '跳过交互提示')
  .action((_name: string, _opts: unknown) => {
    console.log(chalk.yellow('⚠ remove 命令尚未实现，将在后续阶段开发'));
  });

// ─── TODO: deploy ────────────────────────────────
program
  .command('deploy <name>')
  .description('分发 skill 到 Agent')
  .option('-a, --agents <agents>', '目标 Agent（逗号分隔）')
  .option('--copy', '使用复制模式')
  .option('--force', '强制覆盖')
  .option('--dry-run', '预览')
  .action((_name: string, _opts: unknown) => {
    console.log(chalk.yellow('⚠ deploy 命令尚未实现，将在后续阶段开发'));
  });

// ─── TODO: undeploy ──────────────────────────────
program
  .command('undeploy <name>')
  .description('取消 skill 分发')
  .option('-a, --agents <agents>', '目标 Agent（逗号分隔）')
  .option('--all', '取消所有分发')
  .action((_name: string, _opts: unknown) => {
    console.log(chalk.yellow('⚠ undeploy 命令尚未实现，将在后续阶段开发'));
  });

// ─── TODO: search ────────────────────────────────
program
  .command('search <query>')
  .description('搜索 skill')
  .option('--local', '仅搜索本地')
  .option('--remote', '仅搜索远程')
  .action((_query: string, _opts: unknown) => {
    console.log(chalk.yellow('⚠ search 命令尚未实现，将在后续阶段开发'));
  });

// ─── TODO: sync ──────────────────────────────────
program
  .command('sync')
  .description('同步中央仓库到远程 Git')
  .option('--push', '推送到远程')
  .option('--pull', '拉取远程')
  .option('-m, --message <msg>', '提交信息')
  .option('--strategy <strategy>', '冲突策略')
  .option('--dry-run', '预览')
  .action((_opts: unknown) => {
    console.log(chalk.yellow('⚠ sync 命令尚未实现，将在后续阶段开发'));
  });

// ─── TODO: import ────────────────────────────────
program
  .command('import [path]')
  .description('导入散落 skill')
  .option('--namespace <name>', '命名空间', 'local')
  .option('--link', '替换原位置为 symlink')
  .option('-y, --yes', '跳过交互提示')
  .action((_path: string | undefined, _opts: unknown) => {
    console.log(chalk.yellow('⚠ import 命令尚未实现，将在后续阶段开发'));
  });

// ─── TODO: clean ─────────────────────────────────
program
  .command('clean')
  .description('清理缓存和临时文件')
  .option('--cache', '清理缓存')
  .option('--backups', '清理旧备份')
  .option('--all', '清理所有')
  .action((_opts: unknown) => {
    console.log(chalk.yellow('⚠ clean 命令尚未实现，将在后续阶段开发'));
  });

// ─── TODO: tag ───────────────────────────────────
program
  .command('tag <action> [name] [tag]')
  .description('管理 skill 标签')
  .action((_action: string, _name: string | undefined, _tag: string | undefined) => {
    console.log(chalk.yellow('⚠ tag 命令尚未实现，将在后续阶段开发'));
  });

program.parse();
