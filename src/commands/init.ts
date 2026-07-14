/**
 * init 命令 — 初始化 SkillSync 中央仓库
 *
 * 参考 PRD §7.6 init 命令规范
 *
 * 流程：
 * 1. 创建中央仓库目录结构
 * 2. 生成 config.yaml（默认配置）
 * 3. 生成 secrets.yaml（空文件，权限 0600）
 * 4. 生成 skills-lock.json（空结构）
 * 5. 初始化 Git 仓库（如果指定 --git）
 * 6. 扫描已安装 Agent 的散落 skill（可选）
 * 7. 输出初始化结果
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { getHomeDir, configPath, secretsPath, lockPath, skillsDirPath, cachePath, tempPath } from '../lib/paths.js';
import { writeConfig, writeSecrets, getDefaultConfig } from '../config.js';
import { readLock, writeLock } from '../lib/lock.js';
import { LOCKFILE_VERSION, CLI_VERSION } from '../lib/constants.js';
import { detectInstalledAgents, getAgents, getAgentDisplayName } from '../lib/agents.js';
import { scanAllAgents, filterUnmanaged, groupBySkillName } from '../core/scanner.js';
import { importSkill } from '../core/skill-manager.js';
import { createContext } from '../core/context.js';
import type { LockFile } from '../lib/types.js';
import type { SkillSyncContext } from '../core/context.js';

export interface InitOpts {
  /** 是否初始化 Git 仓库 */
  git?: boolean;
  /** 是否扫描并导入散落 skill */
  scan?: boolean;
  /** 导入散落 skill 时是否替换为 symlink */
  link?: boolean;
  /** 命名空间（导入散落 skill 时使用） */
  namespace?: string;
  /** 是否跳过交互提示 */
  yes?: boolean;
}

/**
 * 执行 init 命令
 */
export async function initCommand(opts: InitOpts): Promise<void> {
  const homeDir = getHomeDir();

  console.log(chalk.cyan('╔══════════════════════════════════════╗'));
  console.log(chalk.cyan('║     SkillSync 初始化                 ║'));
  console.log(chalk.cyan('╚══════════════════════════════════════╝'));
  console.log();
  console.log(chalk.gray(`中央仓库路径: ${homeDir}`));
  console.log();

  // 1. 检查是否已初始化
  if (fs.existsSync(configPath())) {
    console.log(chalk.yellow('⚠  中央仓库已存在配置文件'));
    if (!opts.yes) {
      // TODO: 使用 inquirer 确认覆盖
      console.log(chalk.gray('  已跳过（使用 --yes 确认覆盖）'));
      // 不覆盖，直接返回
      return;
    }
  }

  // 2. 创建目录结构
  console.log(chalk.blue('▸ 创建目录结构...'));
  const dirs = [
    homeDir,
    skillsDirPath(),
    cachePath(),
    tempPath(),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(chalk.gray(`  ✓ ${dir}`));
    } else {
      console.log(chalk.gray(`  - ${dir} (已存在)`));
    }
  }
  console.log();

  // 3. 生成 config.yaml
  console.log(chalk.blue('▸ 生成 config.yaml...'));
  const defaultConfig = getDefaultConfig();
  writeConfig(defaultConfig);
  console.log(chalk.gray(`  ✓ ${configPath()}`));
  console.log();

  // 4. 生成 secrets.yaml
  console.log(chalk.blue('▸ 生成 secrets.yaml...'));
  writeSecrets({});
  console.log(chalk.gray(`  ✓ ${secretsPath()} (权限 0600)`));
  console.log();

  // 5. 生成 skills-lock.json
  console.log(chalk.blue('▸ 生成 skills-lock.json...'));
  const lockData: LockFile = {
    lockfileVersion: LOCKFILE_VERSION,
    generatedAt: new Date().toISOString(),
    generator: `skill-sync v${CLI_VERSION}`,
    skills: {},
  };
  writeLock(lockData);
  console.log(chalk.gray(`  ✓ ${lockPath()}`));
  console.log();

  // 6. 检测已安装的 Agent
  console.log(chalk.blue('▸ 检测已安装的 Agent...'));
  const installed = detectInstalledAgents();
  if (installed.length === 0) {
    console.log(chalk.gray('  未检测到已安装的 Agent'));
  } else {
    for (const agent of installed) {
      console.log(chalk.green(`  ✓ ${getAgentDisplayName(agent)} (${agent})`));
    }
  }
  console.log();

  // 7. 可选：扫描散落 skill
  if (opts.scan) {
    console.log(chalk.blue('▸ 扫描散落 skill...'));
    const ctx = createContext();
    const allSkills = scanAllAgents(ctx);
    const unmanaged = filterUnmanaged(allSkills);

    if (unmanaged.length === 0) {
      console.log(chalk.gray('  未发现散落 skill'));
    } else {
      const grouped = groupBySkillName(unmanaged);
      console.log(chalk.gray(`  发现 ${unmanaged.length} 个散落 skill（${grouped.size} 个唯一名称）`));

      const namespace = opts.namespace || 'local';
      let imported = 0;

      for (const [skillName, instances] of grouped) {
        // 取第一个实例导入
        const first = instances[0]!;
        try {
          const result = importSkill(ctx, first, namespace, {
            replaceWithLink: opts.link ?? false,
          });
          console.log(chalk.green(`  ✓ 导入 ${result.name} (v${result.version})`));
          if (result.deployed.length > 0) {
            console.log(chalk.gray(`    已替换为 symlink: ${result.deployed.join(', ')}`));
          }
          imported++;
        } catch (e) {
          console.log(chalk.red(`  ✗ 导入 ${skillName} 失败: ${(e as Error).message}`));
        }
      }
      console.log(chalk.gray(`\n  共导入 ${imported} 个 skill`));
    }
    console.log();
  }

  // 8. 可选：初始化 Git
  if (opts.git) {
    console.log(chalk.blue('▸ 初始化 Git 仓库...'));
    try {
      const simpleGitModule = await import('simple-git');
      const git = simpleGitModule.simpleGit(homeDir);

      if (!fs.existsSync(path.join(homeDir, '.git'))) {
        await git.init();
        console.log(chalk.gray('  ✓ git init'));

        // .gitignore — 白名单模式：默认忽略一切，只允许需要跟踪的文件
        // 这样 secrets.yaml、cache/、temp/、web/ 等永远不会被提交
        const gitignoreContent = [
          '# SkillSync .gitignore — 白名单模式',
          '# 默认忽略所有文件，只跟踪下方显式允许的文件/目录',
          '',
          '# 忽略一切',
          '/*',
          '',
          '# 显式允许跟踪的文件',
          '!/.gitignore',
          '!/config.yaml',
          '!/skills-lock.json',
          '!/tags.yaml',
          '',
          '# 显式允许跟踪的目录',
          '!/skills/',
          '',
          '# skills/ 下的备份目录不跟踪',
          '/skills/**/.backup/',
          '',
          '# OS / 编辑器',
          '.DS_Store',
          'Thumbs.db',
          '*.swp',
          '*.swo',
          '',
        ].join('\n');
        fs.writeFileSync(path.join(homeDir, '.gitignore'), gitignoreContent);
        console.log(chalk.gray('  ✓ .gitignore (白名单模式: secrets.yaml/cache/temp/web 自动排除)'));

        // 初始提交
        await git.add('.');
        await git.commit('skill-sync: initial commit');
        console.log(chalk.gray('  ✓ initial commit'));
      } else {
        console.log(chalk.gray('  - Git 仓库已存在'));
      }
    } catch (e) {
      console.log(chalk.red(`  ✗ Git 初始化失败: ${(e as Error).message}`));
    }
    console.log();
  }

  // 9. 完成
  console.log(chalk.green('✓ SkillSync 初始化完成！'));
  console.log();
  console.log(chalk.gray('下一步：'));
  console.log(chalk.gray('  skill-sync add <github-url>  # 添加 skill'));
  console.log(chalk.gray('  skill-sync list              # 查看已管理的 skill'));
  console.log(chalk.gray('  skill-sync status            # 查看状态'));
}
