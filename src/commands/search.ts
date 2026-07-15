/**
 * search 命令 — 搜索 skill（本地模糊 + skills.sh）
 *
 * 参考 PRD §7 search 命令规范
 *
 * 用法：
 *   skill-sync search <query> [options]
 *
 * 选项：
 *   --local   仅搜索本地
 *   --remote  仅搜索 skills.sh
 *   --limit <n>  返回结果数量限制（默认: 20）
 */

import chalk from 'chalk';
import { searchAll, searchLocal, searchRemote } from '../lib/search.js';
import { handleCommandError } from '../lib/errors.js';
import type { SearchResult } from '../lib/types.js';

export async function searchCommand(query: string, opts: {
  local?: boolean;
  remote?: boolean;
  limit?: string;
}): Promise<void> {
  const limit = opts.limit ? parseInt(opts.limit, 10) : 20;

  try {
    // 确定搜索范围
    const localOnly = opts.local && !opts.remote;
    const remoteOnly = opts.remote && !opts.local;

    if (localOnly) {
      const results = searchLocal(query, limit);
      printLocalResults(results, query);
    } else if (remoteOnly) {
      const results = await searchRemote(query, limit);
      printRemoteResults(results, query);
    } else {
      // 综合
      const { local, remote } = await searchAll(query, { limit });
      printLocalResults(local, query);
      if (local.length > 0 && remote.length > 0) {
        console.log();
      }
      printRemoteResults(remote, query);
    }
  } catch (e) {
    handleCommandError(e);
  }
}

/**
 * 打印本地搜索结果
 */
function printLocalResults(results: SearchResult[], query: string): void {
  if (results.length === 0) return;

  console.log(chalk.cyan('本地搜索结果'));
  console.log(chalk.gray('─'.repeat(70)));

  for (const r of results) {
    const version = r.localVersion ? chalk.gray(` v${r.localVersion}`) : '';
    console.log(`  ${chalk.green(r.name)}${version}`);
    if (r.description) {
      console.log(chalk.gray(`    ${r.description}`));
    }
  }
}

/**
 * 打印远程搜索结果
 */
function printRemoteResults(results: SearchResult[], query: string): void {
  if (results.length === 0) {
    console.log(chalk.gray('远程搜索无结果'));
    return;
  }

  console.log(chalk.cyan('skills.sh 搜索结果'));
  console.log(chalk.gray('─'.repeat(70)));

  for (const r of results) {
    const stars = r.stars !== undefined ? chalk.yellow(` ★${r.stars}`) : '';
    const installs = r.installs !== undefined ? chalk.gray(` ↓${r.installs}`) : '';
    console.log(`  ${chalk.blue(r.name)}${stars}${installs}`);
    console.log(chalk.gray(`    ${r.source}/${r.skillId}`));
    if (r.description) {
      console.log(chalk.gray(`    ${r.description}`));
    }
  }

  console.log(chalk.gray(`\n  安装: skill-sync install <source>/<skillId>`));
}
