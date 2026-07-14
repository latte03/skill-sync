/**
 * 测试工具模块
 *
 * 参考 PRD §17 灰度测试约束 + AGENT.md
 *
 * 核心原则：禁止动用用户真实 skill 目录
 * 通过 SKILL_SYNC_HOME 和 SKILL_SYNC_AGENTS_DIR 环境变量实现隔离
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * 创建临时测试环境
 *
 * 返回隔离的 homeDir 和 agentsDir，自动设置环境变量
 */
export function createTestEnv(): {
  homeDir: string;
  agentsDir: string;
  cleanup: () => void;
} {
  const tmpBase = path.join(os.tmpdir(), `skill-sync-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const homeDir = path.join(tmpBase, 'home');
  const agentsDir = path.join(tmpBase, 'agents');

  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });

  // 设置环境变量（paths.ts 会读取）
  process.env.SKILL_SYNC_HOME = homeDir;
  process.env.SKILL_SYNC_AGENTS_DIR = agentsDir;

  return {
    homeDir,
    agentsDir,
    cleanup: () => {
      try {
        fs.rmSync(tmpBase, { recursive: true, force: true });
      } catch {
        // ignore
      }
      delete process.env.SKILL_SYNC_HOME;
      delete process.env.SKILL_SYNC_AGENTS_DIR;
    },
  };
}

/**
 * 在测试目录中创建模拟 Agent 的 skill 目录结构
 */
export function mockAgentSkillDir(agentsDir: string, agentSkillsDir: string): string {
  const dir = path.join(agentsDir, agentSkillsDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 创建模拟的 SKILL.md 文件
 */
export function createMockSkillMd(
  dir: string,
  opts?: {
    name?: string;
    description?: string;
    version?: string;
    content?: string;
  },
): string {
  const skillMdPath = path.join(dir, 'SKILL.md');
  const frontmatter = [
    '---',
    `name: ${opts?.name ?? 'test-skill'}`,
    `description: ${opts?.description ?? 'A test skill for unit testing'}`,
  ];
  if (opts?.version) {
    frontmatter.push('metadata:');
    frontmatter.push(`  version: ${opts.version}`);
  }
  frontmatter.push('---', '');
  frontmatter.push(opts?.content ?? '# Test Skill\n\nThis is a test skill.');

  fs.writeFileSync(skillMdPath, frontmatter.join('\n'), 'utf-8');
  return skillMdPath;
}

/**
 * 创建一个完整的模拟 skill 目录（含 SKILL.md）
 */
export function createMockSkillDir(
  parentDir: string,
  skillName: string,
  opts?: {
    name?: string;
    description?: string;
    version?: string;
    extraFiles?: Record<string, string>;
  },
): string {
  const dir = path.join(parentDir, skillName);
  fs.mkdirSync(dir, { recursive: true });
  createMockSkillMd(dir, opts);

  if (opts?.extraFiles) {
    for (const [filename, content] of Object.entries(opts.extraFiles)) {
      const filePath = path.join(dir, filename);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
    }
  }

  return dir;
}

/**
 * 手动 setup/teardown 测试环境（适用于 beforeEach/afterEach 场景）
 *
 * 返回临时目录路径，在 afterEach 中调用 cleanupTestEnv 清理
 */
export function setupTestEnv(): { tempDir: string; homeDir: string; agentsDir: string } {
  const env = createTestEnv();
  // 额外创建一个 tempDir 用于存放测试用的 skill 源文件
  const tempDir = path.join(path.dirname(env.homeDir), 'source');
  fs.mkdirSync(tempDir, { recursive: true });

  // 将 env 存储在全局变量中供 cleanupTestEnv 使用
  (globalThis as Record<string, unknown>).__testEnv = env;
  (globalThis as Record<string, unknown>).__testTempDir = tempDir;

  return { tempDir, homeDir: env.homeDir, agentsDir: env.agentsDir };
}

/**
 * 清理测试环境
 */
export function cleanupTestEnv(): void {
  const env = (globalThis as Record<string, unknown>).__testEnv as ReturnType<typeof createTestEnv> | undefined;
  if (env) {
    env.cleanup();
    delete (globalThis as Record<string, unknown>).__testEnv;
    delete (globalThis as Record<string, unknown>).__testTempDir;
  }
}
