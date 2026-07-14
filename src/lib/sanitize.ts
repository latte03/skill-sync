/**
 * 终端转义序列清理模块
 *
 * 参考 vercel-labs/skills 的 sanitize.ts 设计：
 * - 剥离所有终端转义序列，防止 CWE-150（终端转义注入）
 * - 适用于来自 SKILL.md frontmatter 或远程 API 的不可信数据
 * - 在输出到终端前清理，防止恶意数据清屏、移动光标、修改窗口标题等
 */

// CSI 序列: ESC[ + 参数字节 (0x30-0x3F) + 中间字节 (0x20-0x2F) + 终止字节 (0x40-0x7E)
const CSI_RE = /\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g;

// OSC 序列: ESC] ... 以 BEL (\x07) 或 ST (ESC\) 结束
const OSC_RE = /\x1b\][\s\S]*?(?:\x07|\x1b\\)/g;

// DCS, PM, APC 序列: ESC P|^|_ ... 以 ST (ESC\) 结束
const DCS_PM_APC_RE = /\x1b[P^_][\s\S]*?(?:\x1b\\)/g;

// 简单两字节转义序列: ESC + 单个字符 (0x20-0x7E)
const SIMPLE_ESC_RE = /\x1b[\x20-\x7e]/g;

// C1 控制码 (0x80-0x9F) — ESC 序列的 8 位等价
const C1_RE = /[\x80-\x9f]/g;

// 原始控制字符（除 tab \x09 和 newline \x0a 外）
const CONTROL_RE = /[\x00-\x06\x07\x08\x0b\x0c\x0d-\x1a\x1c-\x1f\x7f]/g;

/**
 * 剥离所有终端转义序列和危险控制字符
 */
export function stripTerminalEscapes(str: string): string {
  return str
    .replace(OSC_RE, '') // OSC 优先（最长匹配）
    .replace(DCS_PM_APC_RE, '') // DCS/PM/APC
    .replace(CSI_RE, '') // CSI 序列
    .replace(SIMPLE_ESC_RE, '') // 简单 ESC+字符
    .replace(C1_RE, '') // C1 控制码
    .replace(CONTROL_RE, ''); // 原始控制字符（保留 \t \n）
}

/**
 * 清理 skill 元数据字符串（name, description 等）用于安全终端显示
 *
 * 除剥离转义序列外，还会修剪空白并将内部换行折叠为空格
 */
export function sanitizeMetadata(str: string): string {
  return stripTerminalEscapes(str)
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * 将 skill 名转为安全的 kebab-case 名称
 * 防止路径遍历攻击（如 ../../etc/passwd）
 */
export function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    || 'unnamed-skill';
}

/**
 * 验证路径在预期基础目录内
 * 防止路径遍历攻击
 */
export function isPathSafe(targetPath: string, basePath: string): boolean {
  const resolved = pathResolve(targetPath);
  const base = pathResolve(basePath);
  return resolved.startsWith(base + pathSep) || resolved === base;
}

import path from 'node:path';

const pathResolve = path.resolve;
const pathSep = path.sep;
