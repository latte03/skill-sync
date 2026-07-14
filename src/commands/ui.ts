/**
 * ui 命令 — 启动 Web Dashboard
 *
 * 参考 PRD §7 ui 命令规范
 *
 * 用法：
 *   skill-sync ui [options]
 *
 * 选项：
 *   --port <port>   指定端口（默认: 从 17170 开始递增寻找可用端口）
 *   --no-open       不自动打开浏览器
 *   --host <host>   监听地址（默认: localhost）
 */

import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import chalk from 'chalk';
import { app } from '../server/app.js';
import { getHomeDir } from '../lib/paths.js';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PORT_START = 17170;

/**
 * 查找可用端口
 *
 * 从 startPort 开始递增，直到找到可用端口
 */
function findAvailablePort(startPort: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on('error', () => {
      // 端口被占用，尝试下一个
      if (startPort < 65535) {
        resolve(findAvailablePort(startPort + 1, host));
      } else {
        reject(new Error('无可用端口'));
      }
    });

    server.listen(startPort, host, () => {
      server.close(() => {
        resolve(startPort);
      });
    });
  });
}

/**
 * 打开浏览器
 */
async function openBrowser(url: string): Promise<void> {
  const { default: open } = await import('open');
  await open(url);
}

export async function uiCommand(opts: {
  port?: string;
  open?: boolean;
  host?: string;
}): Promise<void> {
  const host = opts.host ?? 'localhost';
  const shouldOpen = opts.open !== false;

  // 确定端口
  let port: number;
  if (opts.port) {
    port = parseInt(opts.port, 10);
  } else {
    port = await findAvailablePort(DEFAULT_PORT_START, host);
  }

  // 检查静态文件是否存在（生产模式）
  const homeWebDir = path.join(getHomeDir(), 'web');
  const distWebDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
  const hasStaticFiles = fs.existsSync(path.join(homeWebDir, 'index.html')) ||
    fs.existsSync(path.join(distWebDir, 'index.html'));

  // 启动服务器
  console.log(chalk.cyan('\n  ╔══════════════════════════════════════╗'));
  console.log(chalk.cyan('  ║     SkillSync Web Dashboard           ║'));
  console.log(chalk.cyan('  ╚══════════════════════════════════════╝'));
  console.log();
  console.log(`  ${chalk.gray('Host:')}       ${host}`);
  console.log(`  ${chalk.gray('Port:')}       ${port}`);
  console.log(`  ${chalk.gray('URL:')}        ${chalk.blue(`http://${host}:${port}`)}`);
  console.log(`  ${chalk.gray('Mode:')}       ${hasStaticFiles ? 'production' : 'development (API only)'}`);
  console.log();

  if (!hasStaticFiles) {
    console.log(chalk.yellow('  ⚠ 未找到前端静态文件，仅启动 API 服务。'));
    console.log(chalk.gray('     开发模式请同时运行: pnpm dev:web'));
    console.log(chalk.gray('     生产模式请先构建: pnpm build:web'));
    console.log();
  }

  serve({
    fetch: app.fetch,
    port,
    hostname: host,
  });

  console.log(chalk.green(`  ✓ 服务已启动: http://${host}:${port}`));
  console.log(chalk.gray('  按 Ctrl+C 停止服务'));
  console.log();

  // 自动打开浏览器
  if (shouldOpen && hasStaticFiles) {
    try {
      await openBrowser(`http://${host}:${port}`);
      console.log(chalk.gray('  已打开浏览器'));
    } catch {
      console.log(chalk.gray('  无法自动打开浏览器，请手动访问上述 URL'));
    }
  }

  // 保持进程运行
  return new Promise(() => {});
}
