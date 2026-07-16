/**
 * manifest.yaml 读写模块
 *
 * manifest.yaml 是 skill 级真相源（PRD §5.3）。
 * 每个 skill 目录下有一个 manifest.yaml，记录该 skill 的完整元数据。
 */

import fs from 'node:fs';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { manifestPath } from './paths.js';
import type { Manifest } from './types.js';

/**
 * 读取 skill 的 manifest.yaml
 */
export function readManifest(name: string): Manifest {
  const p = manifestPath(name);
  if (!fs.existsSync(p)) {
    throw new Error(`manifest.yaml 不存在: ${p}`);
  }
  const raw = fs.readFileSync(p, 'utf-8');
  const data = parseYaml(raw) as Manifest;
  return data;
}

/**
 * 写入 skill 的 manifest.yaml
 */
export function writeManifest(name: string, data: Manifest): void {
  const p = manifestPath(name);
  // 确保目录存在
  const dir = p.substring(0, p.lastIndexOf('/'));
  fs.mkdirSync(dir, { recursive: true });
  const yamlStr = stringifyYaml(data, { indent: 2 });
  fs.writeFileSync(p, yamlStr, 'utf-8');
}

/**
 * 检查 skill 的 manifest.yaml 是否存在
 */
export function manifestExists(name: string): boolean {
  return fs.existsSync(manifestPath(name));
}

/**
 * 删除 skill 的 manifest.yaml
 */
export function removeManifest(name: string): void {
  const p = manifestPath(name);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}

/**
 * 从 SKILL.md frontmatter 生成 manifest.yaml 的基础结构
 */
export function createManifestFromFrontmatter(
  data: Record<string, unknown>,
  name: string,
  source: Manifest['source'],
): Manifest {
  const description = typeof data.description === 'string' ? data.description : '';

  // 提取版本号
  const metadata = data.metadata;
  let version = '0.0.0';
  if (metadata && typeof metadata === 'object') {
    const v = (metadata as Record<string, unknown>).version;
    if (typeof v === 'string') version = v;
  } else if (typeof data.version === 'string') {
    version = data.version;
  }

  // 提取依赖
  const dependsOn: Array<{ name: string; version: string }> = [];
  if (metadata && typeof metadata === 'object') {
    const deps = (metadata as Record<string, unknown>).depends_on;
    if (Array.isArray(deps)) {
      for (const dep of deps) {
        if (dep && typeof dep === 'object') {
          const d = dep as Record<string, unknown>;
          dependsOn.push({
            name: String(d.name ?? ''),
            version: String(d.version ?? '*'),
          });
        }
      }
    }
  }

  return {
    name,
    description,
    source,
    currentVersion: version,
    initialVersion: '0.0.0',
    tags: [],
    dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
    distribution: {
      mode: 'symlink',
      targets: [],
    },
  };
}
