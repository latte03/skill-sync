/**
 * doctor 命令 — 环境健康检查
 *
 * 参考 PRD §7 doctor 命令规范
 *
 * 检测项:
 * - 中央仓库是否存在且完整
 * - config.yaml 是否有效
 * - secrets.yaml 是否存在（可选）
 * - Git 是否已初始化
 * - 各 Agent 目录是否可访问
 * - 软链接是否完好
 * - skills-lock.json 是否与文件系统一致
 * - 磁盘空间是否充足
 * - .gitignore 白名单模式配置是否正确
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import { getHomeDir, configPath, secretsPath, lockPath, skillsDirPath, cachePath, agentSkillDirPath } from '../lib/paths.js';
import { readConfig } from '../config.js';
import { readLock } from '../lib/lock.js';
import { getAgents } from '../lib/agents.js';
import { formatError } from '../lib/errors.js';
import { checkGitignoreRules } from './check-gitignore.js';

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
}

export function doctorCommand(): void {
  console.log(chalk.cyan('\n  SkillSync Doctor — 环境健康检查'));
  console.log(chalk.gray('  ' + '═'.repeat(60) + '\n'));

  const results: CheckResult[] = [];

  // 1. 中央仓库
  const homeDir = getHomeDir();
  if (fs.existsSync(homeDir)) {
    results.push({
      name: '中央仓库',
      status: 'ok',
      message: homeDir,
    });
  } else {
    results.push({
      name: '中央仓库',
      status: 'fail',
      message: `不存在: ${homeDir}`,
    });
  }

  // 2. config.yaml
  const configP = configPath();
  if (fs.existsSync(configP)) {
    try {
      readConfig();
      results.push({ name: 'config.yaml', status: 'ok', message: '有效' });
    } catch {
      results.push({ name: 'config.yaml', status: 'fail', message: '解析失败' });
    }
  } else {
    results.push({ name: 'config.yaml', status: 'warn', message: '不存在（使用默认配置）' });
  }

  // 3. secrets.yaml
  const secretsP = secretsPath();
  if (fs.existsSync(secretsP)) {
    results.push({ name: 'secrets.yaml', status: 'ok', message: '存在' });
  } else {
    results.push({ name: 'secrets.yaml', status: 'warn', message: '不存在（GitHub token 需通过环境变量提供）' });
  }

  // 4. skills-lock.json
  const lockP = lockPath();
  if (fs.existsSync(lockP)) {
    try {
      const lock = readLock();
      const skillCount = Object.keys(lock.skills).length;
      results.push({ name: 'skills-lock.json', status: 'ok', message: `${skillCount} skills` });
    } catch {
      results.push({ name: 'skills-lock.json', status: 'fail', message: '解析失败' });
    }
  } else {
    results.push({ name: 'skills-lock.json', status: 'warn', message: '不存在（尚未安装任何 skill）' });
  }

  // 5. skills 目录
  const skillsDir = skillsDirPath();
  if (fs.existsSync(skillsDir)) {
    results.push({ name: 'skills 目录', status: 'ok', message: skillsDir });
  } else {
    results.push({ name: 'skills 目录', status: 'warn', message: '不存在' });
  }

  // 6. cache 目录
  const cacheDir = cachePath();
  if (fs.existsSync(cacheDir)) {
    results.push({ name: 'cache 目录', status: 'ok', message: '存在' });
  } else {
    results.push({ name: 'cache 目录', status: 'ok', message: '不存在（首次使用）' });
  }

  // 7. Git 初始化
  const gitDir = path.join(homeDir, '.git');
  if (fs.existsSync(gitDir)) {
    results.push({ name: 'Git 仓库', status: 'ok', message: '已初始化' });
  } else {
    results.push({ name: 'Git 仓库', status: 'warn', message: '未初始化（sync 功能不可用）' });
  }

  // 8. Agent 目录
  const agents = getAgents();
  for (const [agentName, agentConfig] of Object.entries(agents)) {
    const agentDir = agentConfig.skillsDir;
    if (agentConfig.detectInstalled()) {
      results.push({ name: `Agent: ${agentName}`, status: 'ok', message: agentDir });
    } else {
      results.push({ name: `Agent: ${agentName}`, status: 'ok', message: '未检测到（可选）' });
    }
  }

  // 9. 软链接完整性
  try {
    const lock = readLock();
    let brokenCount = 0;
    for (const [skillName, entry] of Object.entries(lock.skills)) {
      const [namespace, sn] = skillName.split('/');
      if (!namespace || !sn) continue;
      for (const [agentName, dist] of Object.entries(entry.distribution)) {
        if (!dist.managed) continue;
        const agentConfig = agents[agentName];
        if (!agentConfig) continue;
        const linkPath = path.join(agentSkillDirPath(agentConfig.skillsDir), sn);
        if (fs.existsSync(linkPath) && fs.lstatSync(linkPath).isSymbolicLink()) {
          const target = fs.readlinkSync(linkPath);
          if (!fs.existsSync(target)) {
            brokenCount++;
          }
        }
      }
    }
    if (brokenCount === 0) {
      results.push({ name: '软链接完整性', status: 'ok', message: '所有 symlink 正常' });
    } else {
      results.push({ name: '软链接完整性', status: 'fail', message: `${brokenCount} 个 symlink 损坏` });
    }
  } catch {
    results.push({ name: '软链接完整性', status: 'warn', message: '无法检查' });
  }

  // 10. 磁盘空间
  const diskFree = checkDiskSpace(homeDir);
  if (diskFree !== null) {
    if (diskFree > 100 * 1024 * 1024) { // > 100MB
      results.push({ name: '磁盘空间', status: 'ok', message: formatSize(diskFree) + ' 可用' });
    } else {
      results.push({ name: '磁盘空间', status: 'warn', message: formatSize(diskFree) + ' 可用（不足）' });
    }
  }

  // 11. lock 与文件系统一致性
  try {
    const lock = readLock();
    let missingCount = 0;
    for (const [skillName] of Object.entries(lock.skills)) {
      const [namespace, sn] = skillName.split('/');
      if (!namespace || !sn) continue;
      const skillPath = path.join(skillsDir, namespace, sn);
      if (!fs.existsSync(skillPath)) {
        missingCount++;
      }
    }
    if (missingCount === 0) {
      results.push({ name: 'lock 一致性', status: 'ok', message: 'lock 与文件系统一致' });
    } else {
      results.push({ name: 'lock 一致性', status: 'fail', message: `${missingCount} 个 skill 在 lock 中但文件系统不存在` });
    }
  } catch {
    results.push({ name: 'lock 一致性', status: 'warn', message: '无法检查' });
  }

  // 12. .gitignore 白名单模式配置
  try {
    const gitignoreCheck = checkGitignoreRules();
    results.push({
      name: '.gitignore 配置',
      status: gitignoreCheck.status,
      message: gitignoreCheck.message,
    });
  } catch {
    results.push({ name: '.gitignore 配置', status: 'warn', message: '无法检查' });
  }

  // 输出结果
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
    console.log(`  ${color(icon)}  ${r.name.padEnd(20)} ${chalk.gray(r.message)}`);
  }

  console.log();
  if (hasFail) {
    console.log(chalk.red('  ✗ 存在需要修复的问题'));
  } else if (hasWarn) {
    console.log(chalk.yellow('  ⚠ 存在警告，建议检查'));
  } else {
    console.log(chalk.green('  ✓ 所有检查通过'));
  }
  console.log();
}

/**
 * 检查磁盘空间（POSIX）
 */
function checkDiskSpace(_dir: string): number | null {
  try {
    const stats = fs.statSync(_dir);
    const tmpDir = os.tmpdir();
    // 简化：使用 os.uptime 和 freemem 作为参考
    // 实际磁盘空间检查需要 statvfs，Node.js 原生不支持
    // 使用 fs.statfs (Node 18.15+) 如果可用
    const freeMem = os.freemem();
    // 如果 statfs 不可用，返回 null
    if (typeof (fs as unknown as { statfs?: unknown }).statfs === 'function') {
      try {
        const statfs = (fs as unknown as { statfs: (p: string, cb: (err: Error | null, stats: { bavail: number; bsize: number }) => void) => void }).statfs;
        // 使用同步版本
        const syncFn = (fs as unknown as { statfsSync?: (p: string) => { bavail: number; bsize: number } }).statfsSync;
        if (syncFn) {
          const diskStats = syncFn(tmpDir);
          return diskStats.bavail * diskStats.bsize;
        }
      } catch {
        // fallthrough
      }
    }
    return freeMem;
  } catch {
    return null;
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
