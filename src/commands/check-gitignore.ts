/**
 * check-gitignore 命令 — 检测中央仓库 .gitignore 配置是否正确
 *
 * SkillSync 使用白名单模式管理 .gitignore：
 * - `/*` 忽略一切
 * - `!/<file>` 显式允许跟踪的文件/目录
 * - 敏感文件（secrets.yaml）和临时目录（cache/、temp/、web/）必须被排除
 *
 * 检测项：
 * - .gitignore 文件是否存在
 * - 白名单模式 `/*` 是否存在
 * - 必须显式允许的文件/目录是否齐全
 * - 备份目录排除规则是否存在
 * - 敏感文件是否被误允许（安全检查）
 * - OS/编辑器杂项规则是否存在
 *
 * 选项：
 * --fix  自动修复 .gitignore（覆盖为正确内容）
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { getHomeDir } from '../lib/paths.js';

// ─── 正确的 .gitignore 内容（白名单模式） ───────────────────

/**
 * 生成正确的 .gitignore 内容
 */
export function getCorrectGitignoreContent(): string {
  return [
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
}

// ─── 规则定义 ──────────────────────────────────────────────

interface GitignoreRule {
  /** 规则模式（用于匹配，去除注释和空行后的原始行 trim） */
  pattern: string;
  /** 规则类别 */
  category: 'whitelist' | 'allow-file' | 'allow-dir' | 'ignore-pattern' | 'misc';
  /** 描述 */
  description: string;
  /** 是否为必须规则 */
  required: boolean;
}

/** 必须存在的规则（按类别分组） */
const REQUIRED_RULES: GitignoreRule[] = [
  { pattern: '/*', category: 'whitelist', description: '白名单模式：默认忽略所有文件', required: true },
  { pattern: '!/.gitignore', category: 'allow-file', description: '允许跟踪 .gitignore 自身', required: true },
  { pattern: '!/config.yaml', category: 'allow-file', description: '允许跟踪 config.yaml', required: true },
  { pattern: '!/skills-lock.json', category: 'allow-file', description: '允许跟踪 skills-lock.json', required: true },
  { pattern: '!/tags.yaml', category: 'allow-file', description: '允许跟踪 tags.yaml', required: true },
  { pattern: '!/skills/', category: 'allow-dir', description: '允许跟踪 skills/ 目录', required: true },
  { pattern: '/skills/**/.backup/', category: 'ignore-pattern', description: '排除 skills/ 下的备份目录', required: true },
];

/** 敏感文件/目录 — 不应出现在允许列表中（安全检查） */
const FORBIDDEN_ALLOW_PATTERNS: { pattern: string; reason: string }[] = [
  { pattern: '!/secrets.yaml', reason: 'secrets.yaml 包含 API Key 等敏感信息，绝不能被跟踪' },
  { pattern: '!/secrets.yml', reason: 'secrets.yml 可能包含敏感信息，不应被跟踪' },
  { pattern: '!/cache/', reason: 'cache/ 是临时缓存目录，不应被跟踪' },
  { pattern: '!/temp/', reason: 'temp/ 是临时目录，不应被跟踪' },
  { pattern: '!/web/', reason: 'web/ 是前端构建产物，不应被跟踪' },
  { pattern: '!/.env', reason: '.env 可能包含敏感信息，不应被跟踪' },
];

/** 推荐的杂项规则 */
const RECOMMENDED_MISC_RULES: string[] = ['.DS_Store', 'Thumbs.db', '*.swp', '*.swo'];

// ─── 检测结果类型 ───────────────────────────────────────────

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
  /** 如果需要修复，对应的修复动作 */
  fixAction?: 'create' | 'add-rule' | 'remove-rule' | 'overwrite';
  /** 关联的模式 */
  pattern?: string;
}

// ─── 解析 .gitignore ────────────────────────────────────────

/**
 * 解析 .gitignore 文件，提取有效规则行（去除注释和空行）
 */
function parseGitignore(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

// ─── 可复用的检测函数（供 doctor 命令调用） ────────────────────

export interface GitignoreCheckSummary {
  status: 'ok' | 'warn' | 'fail';
  message: string;
}

/**
 * 检测 .gitignore 配置，返回摘要结果（不含 console 输出）
 *
 * 供 doctor 命令和 check-gitignore 命令共享同一套检测逻辑。
 */
export function checkGitignoreRules(): GitignoreCheckSummary {
  const homeDir = getHomeDir();
  const gitignorePath = path.join(homeDir, '.gitignore');

  // 1. 文件不存在
  if (!fs.existsSync(gitignorePath)) {
    return { status: 'fail', message: '文件不存在（使用 check-gitignore --fix 修复）' };
  }

  const rules = parseGitignore(fs.readFileSync(gitignorePath, 'utf-8'));
  const issues: string[] = [];
  const warns: string[] = [];

  // 2. 必须存在的规则
  for (const rule of REQUIRED_RULES) {
    if (!rules.includes(rule.pattern)) {
      issues.push(`缺少 ${rule.pattern}`);
    }
  }

  // 3. 安全检查：敏感文件不应被显式允许
  for (const forbidden of FORBIDDEN_ALLOW_PATTERNS) {
    if (rules.includes(forbidden.pattern)) {
      issues.push(`安全风险: ${forbidden.pattern}`);
    }
  }

  // 4. 推荐的杂项规则
  const missingMisc = RECOMMENDED_MISC_RULES.filter((r) => !rules.includes(r));
  if (missingMisc.length > 0) {
    warns.push(`缺少 OS/编辑器规则: ${missingMisc.join(', ')}`);
  }

  // 5. 白名单模式下的额外允许规则
  if (rules.includes('/*')) {
    const knownAllowPatterns = REQUIRED_RULES
      .filter((r) => r.category === 'allow-file' || r.category === 'allow-dir')
      .map((r) => r.pattern);
    const extraAllowRules = rules.filter(
      (r) => r.startsWith('!') && !knownAllowPatterns.includes(r) && !FORBIDDEN_ALLOW_PATTERNS.some((f) => f.pattern === r),
    );
    if (extraAllowRules.length > 0) {
      warns.push(`未知允许规则: ${extraAllowRules.join(', ')}`);
    }
  }

  if (issues.length > 0) {
    return { status: 'fail', message: issues.join('; ') };
  } else if (warns.length > 0) {
    return { status: 'warn', message: warns.join('; ') };
  } else {
    return { status: 'ok', message: '白名单模式配置正确' };
  }
}

// ─── 命令选项 ────────────────────────────────────────────────

export interface CheckGitignoreOpts {
  /** 自动修复 .gitignore */
  fix?: boolean;
}

// ─── 主命令 ──────────────────────────────────────────────────

export function checkGitignoreCommand(opts: CheckGitignoreOpts = {}): void {
  const homeDir = getHomeDir();
  const gitignorePath = path.join(homeDir, '.gitignore');

  console.log(chalk.cyan('\n  SkillSync — .gitignore 配置检查'));
  console.log(chalk.gray('  ' + '═'.repeat(60) + '\n'));
  console.log(chalk.gray(`  路径: ${gitignorePath}\n`));

  const results: CheckResult[] = [];

  // 1. 检查 .gitignore 是否存在
  if (!fs.existsSync(gitignorePath)) {
    results.push({
      name: '.gitignore 文件',
      status: 'fail',
      message: '文件不存在',
      fixAction: 'create',
    });
  } else {
    results.push({
      name: '.gitignore 文件',
      status: 'ok',
      message: '存在',
    });
  }

  // 2. 读取并解析 .gitignore
  let rules: string[] = [];
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    rules = parseGitignore(content);
  }

  // 3. 检查必须存在的规则
  for (const rule of REQUIRED_RULES) {
    if (rules.includes(rule.pattern)) {
      results.push({
        name: `规则: ${rule.pattern}`,
        status: 'ok',
        message: rule.description,
        pattern: rule.pattern,
      });
    } else {
      results.push({
        name: `规则: ${rule.pattern}`,
        status: 'fail',
        message: `缺失 — ${rule.description}`,
        fixAction: 'add-rule',
        pattern: rule.pattern,
      });
    }
  }

  // 4. 安全检查：敏感文件不应被显式允许
  for (const forbidden of FORBIDDEN_ALLOW_PATTERNS) {
    if (rules.includes(forbidden.pattern)) {
      results.push({
        name: `安全: ${forbidden.pattern}`,
        status: 'fail',
        message: forbidden.reason,
        fixAction: 'remove-rule',
        pattern: forbidden.pattern,
      });
    }
  }

  // 5. 推荐的杂项规则
  const missingMisc = RECOMMENDED_MISC_RULES.filter((r) => !rules.includes(r));
  if (missingMisc.length > 0) {
    results.push({
      name: 'OS/编辑器规则',
      status: 'warn',
      message: `缺少推荐规则: ${missingMisc.join(', ')}`,
      fixAction: 'add-rule',
      pattern: missingMisc.join('\n'),
    });
  } else {
    results.push({
      name: 'OS/编辑器规则',
      status: 'ok',
      message: '齐全',
    });
  }

  // 6. 检查白名单模式核心：`/*` 必须存在
  const hasWhitelistMode = rules.includes('/*');
  if (!hasWhitelistMode) {
    results.push({
      name: '白名单模式',
      status: 'fail',
      message: '缺少 `/*` 规则 — 非 白名单模式下 secrets.yaml 等敏感文件可能被意外跟踪',
      fixAction: 'overwrite',
    });
  } else {
    // 白名单模式下，检查是否有不在白名单中的额外 `!` 规则
    const knownAllowPatterns = REQUIRED_RULES
      .filter((r) => r.category === 'allow-file' || r.category === 'allow-dir')
      .map((r) => r.pattern);
    const extraAllowRules = rules.filter(
      (r) => r.startsWith('!') && !knownAllowPatterns.includes(r) && !FORBIDDEN_ALLOW_PATTERNS.some((f) => f.pattern === r),
    );
    if (extraAllowRules.length > 0) {
      results.push({
        name: '额外允许规则',
        status: 'warn',
        message: `发现未知的允许规则: ${extraAllowRules.join(', ')}`,
      });
    }
  }

  // ─── 输出检测结果 ─────────────────────────────────────────

  let hasFail = false;
  let hasWarn = false;

  for (const r of results) {
    let icon: string;
    let color: (s: string) => string;
    switch (r.status) {
      case 'ok':
        icon = '✓';
        color = chalk.green;
        break;
      case 'warn':
        icon = '⚠';
        color = chalk.yellow;
        hasWarn = true;
        break;
      case 'fail':
        icon = '✗';
        color = chalk.red;
        hasFail = true;
        break;
    }
    console.log(`  ${color(icon)}  ${r.name.padEnd(24)} ${chalk.gray(r.message)}`);
  }

  console.log();

  // ─── 自动修复 ─────────────────────────────────────────────

  const needsFix = results.some((r) => r.fixAction !== undefined);

  if (hasFail) {
    console.log(chalk.red('  ✗ .gitignore 配置存在问题，需要修复'));
  } else if (hasWarn) {
    console.log(chalk.yellow('  ⚠ .gitignore 配置基本正确，但存在一些警告'));
  } else {
    console.log(chalk.green('  ✓ .gitignore 配置正确'));
  }

  if (needsFix) {
    if (opts.fix) {
      console.log(chalk.blue('\n  ▸ 正在修复 .gitignore...'));
      // 直接覆盖为正确内容（白名单模式最安全）
      const correctContent = getCorrectGitignoreContent();

      // 确保中央仓库目录存在
      if (!fs.existsSync(homeDir)) {
        fs.mkdirSync(homeDir, { recursive: true });
      }

      fs.writeFileSync(gitignorePath, correctContent, 'utf-8');
      console.log(chalk.green(`  ✓ 已修复: ${gitignorePath}`));
      console.log(chalk.gray('    已覆盖为标准白名单模式配置'));
    } else {
      console.log(chalk.gray('\n  提示: 使用 --fix 自动修复 .gitignore 配置'));
    }
  }

  console.log();

  // 如果有 fail 且未修复，返回非零退出码
  if (hasFail && !opts.fix) {
    process.exitCode = 1;
  }
}
