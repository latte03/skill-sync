#!/usr/bin/env node

/**
 * SkillSync CLI 入口
 *
 * 参考 PRD §7 CLI 命令规范
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getCliVersion } from '../lib/constants.js';
import { initCommand } from '../commands/init.js';
import { listCommand } from '../commands/list.js';
import { statusCommand } from '../commands/status.js';
import { installCommand } from '../commands/install.js';
import { removeCommand } from '../commands/remove.js';
import { deployCommand, undeployCommand } from '../commands/deploy.js';
import { importCommand } from '../commands/import.js';
import { updateCommand, switchCommand } from '../commands/update.js';
import { searchCommand } from '../commands/search.js';
import { checkCommand } from '../commands/check.js';
import { infoCommand } from '../commands/info.js';
import { tagCommand } from '../commands/tag.js';
import { configCommand } from '../commands/config.js';
import { cleanCommand } from '../commands/clean.js';
import { doctorCommand } from '../commands/doctor.js';
import { syncCommand } from '../commands/sync.js';
import { uiCommand } from '../commands/ui.js';
import { checkGitignoreCommand } from '../commands/check-gitignore.js';
import { recoverInterruptedRemoval } from '../core/distribution-transaction.js';
import { homePath } from '../lib/paths.js';
import { withFileTransaction } from '../lib/persistence.js';

const program = new Command();

// Complete or roll back an interrupted destructive removal before any command
// observes the managed state.
program.hook('preAction', () => {
  withFileTransaction(homePath('.state'), () => recoverInterruptedRemoval());
});

program
  .name('skill-sync')
  .description('跨端跨 Agent 的 AI Skill 统一管理工具')
  .version(getCliVersion(), '-v, --version');

// ─── init ────────────────────────────────────────
program
  .command('init')
  .description('初始化 SkillSync 中央仓库')
  .option('--git', '初始化 Git 仓库')
  .option('--scan', '扫描并导入散落 skill')
  .option('--link', '导入时替换原位置为 symlink')
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

// ─── install ─────────────────────────────────────
program
  .command('install <source>')
  .description('安装 skill（GitHub / 本地路径）')
  .option('-s, --skill <name>', '指定安装哪个 skill（多 skill 仓库时必填）')
  .option('--ref <ref>', 'Git 引用（branch/tag/commit）')
  .option('-a, --agents <agents>', '安装后分发到指定 Agent（逗号分隔）')
  .option('--copy', '使用复制模式（默认 symlink）')
  .option('--no-deploy', '只安装到中央仓库，不自动分发')
  .option('--ignore-deps', '跳过依赖检查')
  .option('-y, --yes', '跳过确认提示')
  .action(async (source: string, opts: {
    skill?: string;
    ref?: string;
    agents?: string;
    copy?: boolean;
    deploy?: boolean;
    ignoreDeps?: boolean;
    yes?: boolean;
  }) => {
    try {
      await installCommand(source, {
        skill: opts.skill,
        ref: opts.ref,
        agents: opts.agents ? opts.agents.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        deployType: opts.copy ? 'copy' : 'symlink',
        noDeploy: opts.deploy === false,
        ignoreDeps: opts.ignoreDeps,
        yes: opts.yes,
      });
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── remove ──────────────────────────────────────
program
  .command('remove <name>')
  .alias('rm')
  .description('删除 skill')
  .option('--all', '删除中央仓库 + 所有 Agent 下的分发')
  .option('--central', '仅删除中央仓库')
  .option('--agent <name>', '仅从指定 Agent 删除')
  .option('-f, --force', '跳过确认')
  .action((name: string, opts: {
    all?: boolean;
    central?: boolean;
    agent?: string;
    force?: boolean;
  }) => {
    try {
      removeCommand(name, opts);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── deploy ──────────────────────────────────────
program
  .command('deploy [name]')
  .description('分发 skill 到 Agent')
  .option('--to <agent>', '目标 Agent（逗号分隔）')
  .option('--all', '分发所有 skill')
  .option('-m, --mode <mode>', '分发模式: symlink | copy')
  .option('-f, --force', '强制覆盖已存在的分发')
  .option('--dry-run', '预览分发操作')
  .action((name: string | undefined, opts: {
    to?: string;
    all?: boolean;
    mode?: 'symlink' | 'copy';
    force?: boolean;
    dryRun?: boolean;
  }) => {
    try {
      deployCommand(name, opts);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── undeploy ────────────────────────────────────
program
  .command('undeploy <name>')
  .description('取消 skill 分发')
  .option('--agent <name>', '指定 Agent（逗号分隔）')
  .option('--all', '从所有 Agent 撤销分发')
  .option('-f, --force', '跳过确认')
  .action((name: string, opts: {
    agent?: string;
    all?: boolean;
    force?: boolean;
  }) => {
    try {
      undeployCommand(name, opts);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── import ──────────────────────────────────────
program
  .command('import [path]')
  .description('导入散落 skill 到中央仓库')
  .option('-a, --agents <agents>', '导入后分发到指定 Agent（逗号分隔）')
  .option('--copy', '使用复制模式（默认 symlink）')
  .option('--no-deploy', '只导入到中央仓库，不自动分发')
  .option('-y, --yes', '跳过确认提示')
  .action((inputPath: string | undefined, opts: {
    agents?: string;
    copy?: boolean;
    deploy?: boolean;
    yes?: boolean;
  }) => {
    try {
      importCommand(inputPath, {
        agents: opts.agents,
        deploy: opts.copy ? 'copy' : 'symlink',
        noDeploy: opts.deploy === false,
        yes: opts.yes,
      });
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── update ─────────────────────────────────────
program
  .command('update [name]')
  .description('更新 skill（自动备份当前版本）')
  .option('--all', '更新所有有更新的 skill')
  .option('--version <ver>', '指定升级到某个版本')
  .option('--no-backup', '不保留备份')
  .option('--dry-run', '预览将要发生的变化')
  .option('-f, --force', '跳过确认')
  .action(async (name: string | undefined, opts: {
    all?: boolean;
    version?: string;
    backup?: boolean;
    dryRun?: boolean;
    force?: boolean;
  }) => {
    try {
      await updateCommand(name, opts);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── switch ──────────────────────────────────────
program
  .command('switch <name>')
  .description('从备份恢复 skill 版本')
  .option('--list', '列出可用备份')
  .option('--backup <id>', '指定恢复的备份 ID')
  .option('-f, --force', '跳过确认')
  .action((name: string, opts: {
    list?: boolean;
    backup?: string;
    force?: boolean;
  }) => {
    try {
      switchCommand(name, opts);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── search ─────────────────────────────────────
program
  .command('search <query>')
  .alias('find')
  .description('搜索 skill（本地模糊 + skills.sh）')
  .option('--local', '仅搜索本地')
  .option('--remote', '仅搜索 skills.sh')
  .option('--limit <n>', '返回结果数量限制', '20')
  .action(async (query: string, opts: {
    local?: boolean;
    remote?: boolean;
    limit?: string;
  }) => {
    try {
      await searchCommand(query, opts);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── check ──────────────────────────────────────
program
  .command('check [name]')
  .description('检查 skill 更新')
  .action(async (name: string | undefined) => {
    try {
      await checkCommand(name);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── info ───────────────────────────────────────
program
  .command('info <name>')
  .description('查看 skill 详情')
  .action((name: string) => {
    try {
      infoCommand(name);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── sync ───────────────────────────────────────
program
  .command('sync <action>')
  .description('同步中央仓库到远程 Git')
  .option('-m, --message <msg>', '提交信息（push）')
  .option('--strategy <strategy>', '冲突策略: ours | theirs | manual | newer | skip')
  .option('--dry-run', '预览操作')
  .action(async (action: string, opts: {
    message?: string;
    strategy?: string;
    dryRun?: boolean;
  }) => {
    try {
      await syncCommand(action, opts);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── clean ──────────────────────────────────────
program
  .command('clean')
  .description('清理缓存/备份/孤儿文件')
  .option('--cache', '清理缓存目录')
  .option('--backups [name]', '清理指定 skill 的备份')
  .option('--orphans', '清理孤儿文件（仅删 symlink）')
  .option('--all', '清理所有')
  .option('-f, --force', '允许删除真实目录')
  .action((opts: {
    cache?: boolean;
    backups?: string | boolean;
    orphans?: boolean;
    all?: boolean;
    force?: boolean;
  }) => {
    try {
      cleanCommand({
        cache: opts.cache,
        backups: typeof opts.backups === 'string' ? opts.backups : (opts.backups ? '' : undefined),
        orphans: opts.orphans,
        all: opts.all,
        force: opts.force,
      });
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── tag ────────────────────────────────────────
program
  .command('tag <action> [name] [tag]')
  .description('管理 skill 标签')
  .action((action: string, name: string | undefined, tag: string | undefined) => {
    try {
      tagCommand(action, name, tag);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── config ─────────────────────────────────────
program
  .command('config <action> [key] [value]')
  .description('配置管理')
  .action((action: string, key: string | undefined, value: string | undefined) => {
    try {
      configCommand(action, key, value);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── doctor ─────────────────────────────────────
program
  .command('doctor')
  .description('环境健康检查')
  .action(() => {
    try {
      doctorCommand();
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── check-gitignore ─────────────────────────────
program
  .command('check-gitignore')
  .description('检测中央仓库 .gitignore 配置是否正确')
  .option('--fix', '自动修复 .gitignore 配置')
  .action((opts: { fix?: boolean }) => {
    try {
      checkGitignoreCommand(opts);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

// ─── ui ──────────────────────────────────────────
program
  .command('ui')
  .description('启动 Web Dashboard')
  .option('--port <port>', '指定端口（默认: 从 17170 自动选择）')
  .option('--no-open', '不自动打开浏览器')
  .option('--host <host>', '监听地址', 'localhost')
  .action(async (opts: {
    port?: string;
    open?: boolean;
    host?: string;
  }) => {
    try {
      await uiCommand(opts);
    } catch (e) {
      console.error(chalk.red(`\n✗ ${(e as Error).message}`));
      process.exit(1);
    }
  });

program.parse();
