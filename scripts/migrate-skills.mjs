#!/usr/bin/env node
/**
 * 迁移脚本：将 ~/.skills-manager/skills/ 下的 skill 导入到 ~/.skill-sync/skills/local/
 *
 * 用法：
 *   node migrate-skills.mjs
 *
 * 做的事情：
 *   1. 遍历 ~/.skills-manager/skills/ 下所有目录
 *   2. 跳过 .git, .skills-manager, .gitignore 等非 skill 目录
 *   3. 解析每个 skill 的 SKILL.md frontmatter 获取 name / description
 *   4. 复制 skill 目录到 ~/.skill-sync/skills/local/<skillName>/
 *   5. 生成 manifest.yaml
 *   6. 更新 skills-lock.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';

// ─── 路径 ──────────────────────────────────────────────────
const OLD_SKILLS_DIR = path.join(process.env.HOME, '.skills-manager', 'skills');
const NEW_HOME_DIR = path.join(process.env.HOME, '.skill-sync');
const NEW_SKILLS_DIR = path.join(NEW_HOME_DIR, 'skills', 'local');
const LOCK_PATH = path.join(NEW_HOME_DIR, 'skills-lock.json');

// ─── 辅助函数 ──────────────────────────────────────────────

/** 解析 SKILL.md 的 YAML frontmatter */
function parseFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return parseYaml(match[1]) ?? {};
}

/** 递归复制目录 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─── 主逻辑 ────────────────────────────────────────────────

// 跳过的目录名
const SKIP_DIRS = new Set(['.git', '.skills-manager', 'node_modules', '.DS_Store']);

// 收集所有 skill 目录
const oldDirs = fs.readdirSync(OLD_SKILLS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !SKIP_DIRS.has(d.name))
  .map(d => d.name)
  .sort();

console.log(`\n📂 发现 ${oldDirs.length} 个 skill 目录`);

// 确保目标目录存在
if (!fs.existsSync(NEW_SKILLS_DIR)) {
  fs.mkdirSync(NEW_SKILLS_DIR, { recursive: true });
}

// 读取现有 lock
let lock = { lockfileVersion: 1, generatedAt: '', generator: 'skill-sync v0.1.0', skills: {} };
if (fs.existsSync(LOCK_PATH)) {
  try {
    lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf-8'));
    if (!lock.skills) lock.skills = {};
  } catch { /* ignore */ }
}

let migrated = 0;
let skipped = 0;
let failed = 0;

for (const dirName of oldDirs) {
  const oldPath = path.join(OLD_SKILLS_DIR, dirName);
  const skillMdPath = path.join(oldPath, 'SKILL.md');

  // 必须有 SKILL.md
  if (!fs.existsSync(skillMdPath)) {
    console.log(`  ⏭️  跳过 ${dirName}（无 SKILL.md）`);
    skipped++;
    continue;
  }

  // 解析 frontmatter
  let fm = {};
  try {
    fm = parseFrontmatter(skillMdPath);
  } catch (e) {
    console.log(`  ⚠️  ${dirName} frontmatter 解析失败: ${e.message}`);
  }

  const skillName = fm.name || dirName;
  const description = fm.description || '';
  const version = (fm.metadata?.version && String(fm.metadata.version)) || '1.0.0';
  const tags = Array.isArray(fm.tags) ? fm.tags : [];

  const destPath = path.join(NEW_SKILLS_DIR, dirName);

  // 跳过已存在的
  if (fs.existsSync(destPath)) {
    console.log(`  ⏭️  跳过 ${dirName}（已存在）`);
    skipped++;
    continue;
  }

  try {
    // 1. 复制 skill 目录
    copyDir(oldPath, destPath);

    // 2. 生成 manifest.yaml
    const manifest = {
      name: skillName,
      namespace: 'local',
      description,
      source: {
        type: 'local',
        installedVia: 'init-scan',
      },
      currentVersion: version,
      tags,
      distribution: {
        mode: 'symlink',
        targets: [],
      },
    };
    fs.writeFileSync(
      path.join(destPath, 'manifest.yaml'),
      stringifyYaml(manifest, { indent: 2 }),
      'utf-8',
    );

    // 3. 更新 lock
    const fullName = `local/${dirName}`;
    lock.skills[fullName] = {
      source: {
        type: 'local',
      },
      version,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      distribution: {},
      postInstallRan: false,
    };

    console.log(`  ✅ ${dirName} v${version}`);
    migrated++;
  } catch (e) {
    console.log(`  ❌ ${dirName} 迁移失败: ${e.message}`);
    failed++;
  }
}

// 写入 lock
lock.generatedAt = new Date().toISOString();
fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n', 'utf-8');

console.log(`\n─── 汇总 ───`);
console.log(`  迁移成功: ${migrated}`);
console.log(`  跳过: ${skipped}`);
console.log(`  失败: ${failed}`);
console.log(`  总计: ${oldDirs.length}`);
console.log(`\n💡 现在可以运行: cd ~/.skill-sync && git add -A && git commit -m "migrate skills from .skills-manager"`);
