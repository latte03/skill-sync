/**
 * Scanner 模块 — 扫描 Agent 目录中的散落 skill
 *
 * 参考 PRD §7.6 init 命令 — 初始化扫描 + TeleAgent scanner.ts
 *
 * 功能：
 * - 扫描指定 Agent 的 skill 目录（支持深度嵌套）
 * - 识别 SKILL.md frontmatter
 * - 区分 managed（symlink 指向中央仓库）和 unmanaged（散落文件）
 * - 返回扫描结果供 init/import 命令使用
 */

import fs from 'node:fs';
import path from 'node:path';
import { getAgents, getAgentSkillDir } from '../lib/agents.js';
import { parseFrontmatter, isValidSkillFrontmatter } from '../lib/frontmatter.js';
import { sanitizeMetadata, sanitizeName } from '../lib/sanitize.js';
import type { ScannedSkill } from '../lib/types.js';
import type { SkillSyncContext } from './context.js';

/**
 * 递归扫描目录下的所有 skill
 * 只要目录中包含 SKILL.md 文件，就视为一个 skill
 * 支持嵌套 skill 目录（如 write-a-skill/engineering/tdd）
 */
function scanSkillDirectory(
  ctx: SkillSyncContext,
  dir: string,
  agentName: string,
  baseDir: string,
  depth: number = 0,
  maxDepth: number = 5
): ScannedSkill[] {
  const results: ScannedSkill[] = [];

  if (depth > maxDepth) {
    ctx.logger.debug(`  达到最大扫描深度 ${maxDepth}，跳过: ${dir}`);
    return results;
  }

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // 首先检查当前目录是否有 SKILL.md（根目录除外）
  const skillMdFile = path.join(dir, 'SKILL.md');
  const hasSkillMd = fs.existsSync(skillMdFile);

  if (hasSkillMd && depth > 0) {
    // 找到 skill，记录它
    const dirName = path.basename(dir);
    const relativePath = path.relative(baseDir, dir);

    // 检测 symlink
    const lstat = fs.lstatSync(dir);
    const isSymlink = lstat.isSymbolicLink();
    let linkTarget: string | undefined;
    if (isSymlink) {
      try {
        linkTarget = fs.readlinkSync(dir);
      } catch {
        linkTarget = undefined;
      }
    }

    // 尝试读取 SKILL.md 获取元数据
    let name = dirName;
    let description: string | undefined;

    const raw = fs.readFileSync(skillMdFile, 'utf-8');
    const { data } = parseFrontmatter(raw);
    if (isValidSkillFrontmatter(data)) {
      name = sanitizeMetadata(String(data.name));
      description = sanitizeMetadata(String(data.description));
    }

    results.push({
      name: sanitizeName(name),
      dir,
      skillMdPath: skillMdFile,
      description,
      agentName,
      isSymlink,
      linkTarget,
      relativePath,
    });

    // 注意：即使当前目录是一个 skill，仍然继续递归扫描子目录
    // 因为可能存在嵌套 skill 结构（如 write-a-skill/engineering/tdd）
  }

  // 递归扫描子目录
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

    const subDir = path.join(dir, entry.name);
    const subResults = scanSkillDirectory(ctx, subDir, agentName, baseDir, depth + 1, maxDepth);
    results.push(...subResults);
  }

  return results;
}

/**
 * 扫描单个 Agent 的 skill 目录
 * 支持深度嵌套目录结构，如 .claude/skills/write-a-skill
 */
export function scanAgentSkills(ctx: SkillSyncContext, agentName: string): ScannedSkill[] {
  const skillDir = getAgentSkillDir(agentName);
  ctx.logger.debug(`扫描 Agent "${agentName}" 的 skill 目录: ${skillDir}`);

  if (!fs.existsSync(skillDir)) {
    ctx.logger.debug(`  目录不存在，跳过`);
    return [];
  }

  const results = scanSkillDirectory(ctx, skillDir, agentName, skillDir, 0);

  ctx.logger.debug(`  发现 ${results.length} 个 skill（managed: ${results.filter(r => r.isSymlink).length}, unmanaged: ${results.filter(r => !r.isSymlink).length}）`);
  return results;
}

/**
 * 扫描所有已安装 Agent 的 skill 目录
 */
export function scanAllAgents(ctx: SkillSyncContext): ScannedSkill[] {
  const agents = getAgents();
  const allSkills: ScannedSkill[] = [];

  for (const agentName of Object.keys(agents)) {
    const skills = scanAgentSkills(ctx, agentName);
    allSkills.push(...skills);
  }

  return allSkills;
}

/**
 * 扫描指定 Agent 列表
 */
export function scanAgents(ctx: SkillSyncContext, agentNames: string[]): ScannedSkill[] {
  const allSkills: ScannedSkill[] = [];
  for (const agentName of agentNames) {
    const skills = scanAgentSkills(ctx, agentName);
    allSkills.push(...skills);
  }
  return allSkills;
}

/**
 * 从扫描结果中过滤出 unmanaged（散落）skill
 */
export function filterUnmanaged(skills: ScannedSkill[]): ScannedSkill[] {
  return skills.filter(s => !s.isSymlink);
}

/**
 * 从扫描结果中过滤出 managed（已纳入管理）skill
 */
export function filterManaged(skills: ScannedSkill[]): ScannedSkill[] {
  return skills.filter(s => s.isSymlink);
}

/**
 * 按名称分组扫描结果（同名 skill 可能出现在多个 Agent 中）
 */
export function groupBySkillName(skills: ScannedSkill[]): Map<string, ScannedSkill[]> {
  const map = new Map<string, ScannedSkill[]>();
  for (const skill of skills) {
    const arr = map.get(skill.name) ?? [];
    arr.push(skill);
    map.set(skill.name, arr);
  }
  return map;
}
