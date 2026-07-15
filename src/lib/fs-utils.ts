/**
 * 文件系统工具模块
 *
 * 提供 cross-module 共享的文件系统操作。
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * 递归复制目录内容
 *
 * 如果目标目录不存在则自动创建。
 *
 * @param exclude 排除的目录/文件名列表（如 ['.backup']）
 */
export function copyDirRecursive(src: string, dest: string, exclude: string[] = []): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
