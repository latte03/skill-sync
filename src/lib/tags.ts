/**
 * Tags 模块 — 标签管理
 *
 * 参考 PRD §5.3 tags.yaml 数据结构 + §7 tag 命令规范
 *
 * tags.yaml 结构:
 *   tags:
 *     document: [pdf-processing, markdown-tools]
 *     coding: [code-review, refactor-helper]
 *
 * 标签也同步写入 manifest.yaml 的 tags 字段
 */

import fs from 'node:fs';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { tagsPath } from './paths.js';
import { readManifest, writeManifest } from './manifest.js';
import { getLockEntry } from './lock.js';

/** tags.yaml 的数据结构 */
interface TagsFile {
  tags: Record<string, string[]>;
}

/**
 * 读取 tags.yaml
 */
function readTagsFile(): TagsFile {
  const p = tagsPath();
  if (!fs.existsSync(p)) {
    return { tags: {} };
  }
  const raw = fs.readFileSync(p, 'utf-8');
  const data = parseYaml(raw) as TagsFile | null;
  return data ?? { tags: {} };
}

/**
 * 写入 tags.yaml
 */
function writeTagsFile(data: TagsFile): void {
  const p = tagsPath();
  const yamlStr = stringifyYaml(data, { indent: 2 });
  fs.writeFileSync(p, yamlStr, 'utf-8');
}

/**
 * 给 skill 添加标签
 *
 * 同时更新 tags.yaml 和 manifest.yaml
 */
export function addTag(name: string, tag: string): void {
  // 检查 skill 是否存在
  const entry = getLockEntry(name);
  if (!entry) {
    throw new Error(`Skill 未找到: ${name}`);
  }

  // 更新 tags.yaml
  const tagsFile = readTagsFile();
  if (!tagsFile.tags[tag]) {
    tagsFile.tags[tag] = [];
  }
  if (!tagsFile.tags[tag].includes(name)) {
    tagsFile.tags[tag].push(name);
  }
  writeTagsFile(tagsFile);

  // 更新 manifest.yaml
  try {
    const manifest = readManifest(name);
    if (!manifest.tags) manifest.tags = [];
    if (!manifest.tags.includes(tag)) {
      manifest.tags.push(tag);
      writeManifest(name, manifest);
    }
  } catch {
    // manifest 可能不存在
  }
}

/**
 * 移除 skill 的标签
 */
export function removeTag(name: string, tag: string): void {
  // 更新 tags.yaml
  const tagsFile = readTagsFile();
  if (tagsFile.tags[tag]) {
    tagsFile.tags[tag] = tagsFile.tags[tag].filter(n => n !== name);
    if (tagsFile.tags[tag].length === 0) {
      delete tagsFile.tags[tag];
    }
  }
  writeTagsFile(tagsFile);

  // 更新 manifest.yaml
  try {
    const manifest = readManifest(name);
    if (manifest.tags) {
      manifest.tags = manifest.tags.filter(t => t !== tag);
      if (manifest.tags.length === 0) {
        delete manifest.tags;
      }
      writeManifest(name, manifest);
    }
  } catch {
    // manifest 可能不存在
  }
}

/**
 * 列出所有标签
 */
export function listAllTags(): Record<string, string[]> {
  return readTagsFile().tags;
}

/**
 * 列出指定标签下的 skill
 */
export function listSkillsByTag(tag: string): string[] {
  const tagsFile = readTagsFile();
  return tagsFile.tags[tag] ?? [];
}

/**
 * 获取 skill 的所有标签
 */
export function getSkillTags(name: string): string[] {
  try {
    const manifest = readManifest(name);
    return manifest.tags ?? [];
  } catch {
    return [];
  }
}
