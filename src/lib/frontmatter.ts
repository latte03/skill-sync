/**
 * SKILL.md frontmatter 解析器
 *
 * - 仅支持 YAML（`---` 分隔符）
 * - 不支持 `---js` / `---javascript`，避免 eval() 导致的 RCE 风险
 * - 返回 data（YAML 元数据）和 content（正文）
 */

import { parse as parseYaml } from 'yaml';
import type { FrontmatterResult } from './types.js';

/**
 * 解析 SKILL.md 的 YAML frontmatter
 *
 * 合法的 SKILL.md frontmatter 必须包含 `name` 和 `description` 字段。
 */
export function parseFrontmatter(raw: string): FrontmatterResult {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n?---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const yamlStr = match[1]!.trim();
  const data = yamlStr ? ((parseYaml(yamlStr) as Record<string, unknown>) ?? {}) : {};
  return { data, content: match[2] ?? '' };
}

/**
 * 检查 frontmatter 是否包含必要的 name 和 description 字段
 */
export function isValidSkillFrontmatter(data: Record<string, unknown>): boolean {
  return typeof data.name === 'string' && typeof data.description === 'string';
}

/**
 * 从 frontmatter 提取版本号
 *
 * 优先级链（PRD §5.3 版本降级处理策略）：
 * 1. metadata.version（显式声明，推荐位置）
 * 2. 顶层 version（兼容社区旧写法，不拒绝但警告）
 * 3. null（需要调用方进一步尝试 Git tag / commit hash）
 */
export function extractVersion(data: Record<string, unknown>): string | null {
  // 1. metadata.version
  const metadata = data.metadata;
  if (metadata && typeof metadata === 'object') {
    const metaVersion = (metadata as Record<string, unknown>).version;
    if (typeof metaVersion === 'string') return metaVersion;
  }

  // 2. 顶层 version
  if (typeof data.version === 'string') return data.version;

  return null;
}

/**
 * 从 frontmatter 提取依赖声明
 */
export function extractDependencies(data: Record<string, unknown>): Array<{ name: string; version: string }> {
  const metadata = data.metadata;
  if (metadata && typeof metadata === 'object') {
    const deps = (metadata as Record<string, unknown>).depends_on;
    if (Array.isArray(deps)) {
      return deps
        .filter((d): d is Record<string, unknown> => d !== null && typeof d === 'object')
        .map((d) => ({
          name: String(d.name ?? ''),
          version: String(d.version ?? '*'),
        }))
        .filter((d) => d.name);
    }
  }
  return [];
}

/**
 * 从 frontmatter 提取 post_install 脚本路径
 */
export function extractPostInstall(data: Record<string, unknown>): string | null {
  const metadata = data.metadata;
  if (metadata && typeof metadata === 'object') {
    const postInstall = (metadata as Record<string, unknown>).post_install;
    if (typeof postInstall === 'string') return postInstall;
  }
  return null;
}

/**
 * 检查 frontmatter 中是否包含 XML 尖括号（安全约束）
 */
export function hasXmlBrackets(data: Record<string, unknown>): boolean {
  const json = JSON.stringify(data);
  return json.includes('<') || json.includes('>');
}
