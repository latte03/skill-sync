/**
 * Agent 注册与检测模块
 *
 * 支持 12+ 个 AI Agent，每个 Agent 有独立的 skill 目录路径和检测逻辑。
 * 支持环境变量覆盖（如 CLAUDE_CONFIG_DIR、CODEX_HOME）。
 * 支持 SKILL_SYNC_AGENTS_DIR 环境变量用于测试隔离。
 */

import path from 'node:path';
import fs from 'node:fs';
import type { AgentConfig } from './types.js';
import { getAgentsBaseDir, agentSkillDirPath } from './paths.js';

/**
 * Agent 注册表
 */
function buildAgents(): Record<string, AgentConfig> {
  const home = getAgentsBaseDir();
  const configHome = process.env.XDG_CONFIG_HOME?.trim() || path.join(home, '.config');
  const claudeHome = process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(home, '.claude');
  const codexHome = process.env.CODEX_HOME?.trim() || path.join(home, '.codex');
  const hermesHome = process.env.HERMES_HOME?.trim() || path.join(home, '.hermes');

  return {
    'claude-code': {
      name: 'claude-code',
      displayName: 'Claude Code',
      skillsDir: '.claude/skills',
      detectInstalled: () => fs.existsSync(claudeHome),
    },

    cursor: {
      name: 'cursor',
      displayName: 'Cursor',
      skillsDir: '.cursor/skills',
      detectInstalled: () => fs.existsSync(path.join(home, '.cursor')),
    },

    opencode: {
      name: 'opencode',
      displayName: 'OpenCode',
      skillsDir: '.config/opencode/skills',
      detectInstalled: () => fs.existsSync(path.join(configHome, 'opencode')),
    },

    codex: {
      name: 'codex',
      displayName: 'Codex',
      skillsDir: '.codex/skills',
      detectInstalled: () => fs.existsSync(codexHome) || fs.existsSync('/etc/codex'),
    },

    codebuddy: {
      name: 'codebuddy',
      displayName: 'CodeBuddy',
      skillsDir: '.codebuddy/skills',
      detectInstalled: () => fs.existsSync(path.join(home, '.codebuddy')),
    },

    'hermes-agent': {
      name: 'hermes-agent',
      displayName: 'Hermes Agent',
      skillsDir: '.hermes/skills',
      detectInstalled: () => fs.existsSync(hermesHome),
    },

    qoder: {
      name: 'qoder',
      displayName: 'Qoder',
      skillsDir: '.qoder/skills',
      detectInstalled: () => fs.existsSync(path.join(home, '.qoder')),
    },

    'qoder-cn': {
      name: 'qoder-cn',
      displayName: 'Qoder CN',
      skillsDir: '.qoder-cn/skills',
      detectInstalled: () => fs.existsSync(path.join(home, '.qoder-cn')),
    },

    trae: {
      name: 'trae',
      displayName: 'Trae',
      skillsDir: '.trae/skills',
      detectInstalled: () => fs.existsSync(path.join(home, '.trae')),
    },

    'trae-cn': {
      name: 'trae-cn',
      displayName: 'Trae CN',
      skillsDir: '.trae-cn/skills',
      detectInstalled: () => fs.existsSync(path.join(home, '.trae-cn')),
    },

    teleagent: {
      name: 'teleagent',
      displayName: 'TeleAgent',
      skillsDir: '.config/TeleAgent/skills',
      detectInstalled: () => fs.existsSync(path.join(home, '.config/TeleAgent')),
    },

    openclaw: {
      name: 'openclaw',
      displayName: 'OpenClaw',
      skillsDir: '.openclaw/skills',
      detectInstalled: () =>
        fs.existsSync(path.join(home, '.openclaw')) ||
        fs.existsSync(path.join(home, '.clawdbot')) ||
        fs.existsSync(path.join(home, '.moltbot')),
    },
  };
}

/** 缓存的 Agent 注册表（构建一次后复用） */
let _agents: Record<string, AgentConfig> | null = null;

/**
 * 获取所有 Agent 配置
 */
export function getAgents(): Record<string, AgentConfig> {
  if (!_agents) {
    _agents = buildAgents();
  }
  return _agents;
}

/**
 * 获取 Agent 配置
 */
export function getAgentConfig(name: string): AgentConfig | undefined {
  return getAgents()[name];
}

/**
 * 获取 Agent 的 skill 目录绝对路径
 *
 * 受 SKILL_SYNC_AGENTS_DIR 环境变量影响（测试隔离）
 */
export function getAgentSkillDir(agentName: string): string {
  const agent = getAgents()[agentName];
  if (!agent) {
    throw new Error(`未知 Agent: ${agentName}，可用: ${Object.keys(getAgents()).join(', ')}`);
  }
  return agentSkillDirPath(agent.skillsDir);
}

/**
 * 获取 Agent 的显示名
 */
export function getAgentDisplayName(name: string): string {
  return getAgents()[name]?.displayName ?? name;
}

/**
 * 检测本机已安装的 Agent 列表
 */
export function detectInstalledAgents(): string[] {
  return Object.entries(getAgents())
    .filter(([_, config]) => config.detectInstalled())
    .map(([name]) => name);
}

/**
 * 获取所有支持的 Agent 名称列表
 */
export function getSupportedAgents(): string[] {
  return Object.keys(getAgents());
}

/**
 * 重置 Agent 注册表缓存（测试用）
 */
export function resetAgentsCache(): void {
  _agents = null;
}
