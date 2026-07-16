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
import { homePath, tagsPath } from './paths.js';
import { manifestExists, readManifest, writeManifest } from './manifest.js';
import { getLockEntry } from './lock.js';
import { atomicWriteFile, withFileTransaction } from './persistence.js';

/** tags.yaml 的数据结构 */
interface TagsFile {
  tags: Record<string, string[]>;
}

interface TagTransactionJournal {
  name: string;
  originalTagsFile: TagsFile;
  nextTagsFile: TagsFile;
  originalManifest: ReturnType<typeof readManifest> | null;
  nextManifest: ReturnType<typeof readManifest> | null;
}

function tagJournalPath(): string {
  return `${tagsPath()}.transaction`;
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
  atomicWriteFile(p, yamlStr);
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

  withStateAndTagsTransaction(() => {
    const tagsFile = readTagsFile();
    const originalTagsFile = structuredClone(tagsFile);
    const manifest = readManifest(name);
    const originalManifest = structuredClone(manifest);

    if (!tagsFile.tags[tag]) {
      tagsFile.tags[tag] = [];
    }
    if (!tagsFile.tags[tag].includes(name)) {
      tagsFile.tags[tag].push(name);
    }
    if (!manifest.tags) manifest.tags = [];
    if (!manifest.tags.includes(tag)) {
      manifest.tags.push(tag);
    }

    writeTagAndManifestWithRollback(name, tagsFile, manifest, originalTagsFile, originalManifest);
  });
}

/**
 * 移除 skill 的标签
 */
export function removeTag(name: string, tag: string): void {
  withStateAndTagsTransaction(() => {
    const tagsFile = readTagsFile();
    const originalTagsFile = structuredClone(tagsFile);
    const manifest = manifestExists(name) ? readManifest(name) : null;
    const originalManifest = manifest ? structuredClone(manifest) : null;

    if (tagsFile.tags[tag]) {
      tagsFile.tags[tag] = tagsFile.tags[tag].filter(n => n !== name);
      if (tagsFile.tags[tag].length === 0) {
        delete tagsFile.tags[tag];
      }
    }
    if (manifest?.tags) {
      manifest.tags = manifest.tags.filter(t => t !== tag);
      if (manifest.tags.length === 0) {
        delete manifest.tags;
      }
    }

    writeTagAndManifestWithRollback(name, tagsFile, manifest, originalTagsFile, originalManifest);
  });
}

/** Keep duplicated tag state consistent, and restore the first write on failure. */
function writeTagAndManifestWithRollback(
  name: string,
  tagsFile: TagsFile,
  manifest: ReturnType<typeof readManifest> | null,
  originalTagsFile: TagsFile,
  originalManifest: ReturnType<typeof readManifest> | null,
): void {
  const journal: TagTransactionJournal = {
    name,
    originalTagsFile,
    nextTagsFile: tagsFile,
    originalManifest,
    nextManifest: manifest,
  };
  atomicWriteFile(tagJournalPath(), stringifyYaml(journal, { indent: 2 }));
  try {
    if (manifest) writeManifest(name, manifest);
    writeTagsFile(tagsFile);
    fs.rmSync(tagJournalPath(), { force: true });
  } catch (error) {
    try {
      if (originalManifest) writeManifest(name, originalManifest);
      writeTagsFile(originalTagsFile);
    } catch {
      // Preserve the original state-transition error for the caller.
    }
    throw error;
  }
}

/** Complete a tag write interrupted between the manifest and index commits. */
function recoverInterruptedTagTransaction(): void {
  const journalPath = tagJournalPath();
  if (!fs.existsSync(journalPath)) return;

  const journal = parseYaml(fs.readFileSync(journalPath, 'utf-8')) as TagTransactionJournal;
  const currentManifest = manifestExists(journal.name) ? readManifest(journal.name) : null;
  const manifestReachedNextState = sameTags(currentManifest?.tags, journal.nextManifest?.tags);

  if (manifestReachedNextState) {
    writeTagsFile(journal.nextTagsFile);
  } else {
    if (journal.originalManifest) writeManifest(journal.name, journal.originalManifest);
    writeTagsFile(journal.originalTagsFile);
  }
  fs.rmSync(journalPath, { force: true });
}

function sameTags(left: string[] | undefined, right: string[] | undefined): boolean {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

/** Serialize tag changes with long-running remote updates as well as tag writes. */
function withStateAndTagsTransaction<T>(operation: () => T): T {
  return withFileTransaction(homePath('.state'), () =>
    withFileTransaction(tagsPath(), () => {
      recoverInterruptedTagTransaction();
      return operation();
    }),
  );
}

/**
 * 列出所有标签
 */
export function listAllTags(): Record<string, string[]> {
  return withStateAndTagsTransaction(() => readTagsFile().tags);
}

/**
 * 列出指定标签下的 skill
 */
export function listSkillsByTag(tag: string): string[] {
  return withStateAndTagsTransaction(() => readTagsFile().tags[tag] ?? []);
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
