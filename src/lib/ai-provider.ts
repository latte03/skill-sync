/**
 * AI Provider 模块 — 大模型厂商注册表 + API Key 管理 + commit 消息生成
 *
 * 支持 OpenAI-compatible API 格式的厂商。
 * 预设主流厂商，支持自定义厂商。
 */

import { readConfig, writeConfig, readSecrets, writeSecrets } from '../config.js';
import type { AIProviderConfig, AIConfig, Config } from './types.js';

// ─── 预设厂商 ──────────────────────────────────────────────────

const PROVIDER_PRESETS: AIProviderConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    iconColor: '4D6BFE',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    defaultModel: 'gpt-4o-mini',
    iconColor: '412991',
  },
  {
    id: 'moonshot',
    name: '月之暗面 (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultModel: 'moonshot-v1-8k',
    iconColor: '1D6FE3',
  },
  {
    id: 'zhipu',
    name: '智谱 (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4'],
    defaultModel: 'glm-4-flash',
    iconColor: '3855FF',
  },
  {
    id: 'qwen',
    name: '通义千问 (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    defaultModel: 'qwen-turbo',
    iconColor: '615CED',
  },
  {
    id: 'lingyi',
    name: '零一万物 (Yi)',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    models: ['yi-large', 'yi-medium', 'yi-lightning'],
    defaultModel: 'yi-lightning',
    iconColor: '0096FF',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['abab6.5s-chat', 'abab6.5-chat'],
    defaultModel: 'abab6.5s-chat',
    iconColor: 'FF2E2E',
  },
  {
    id: 'stepfun',
    name: '阶跃星辰 (Step)',
    baseUrl: 'https://api.stepfun.com/v1',
    models: ['step-1-8k', 'step-1-32k', 'step-2-16k'],
    defaultModel: 'step-1-8k',
    iconColor: '2962FF',
  },
  {
    id: 'baichuan',
    name: '百川 (Baichuan)',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    models: ['Baichuan4-Turbo', 'Baichuan3-Turbo'],
    defaultModel: 'Baichuan4-Turbo',
    iconColor: 'FF6B00',
  },
  {
    id: 'siliconflow',
    name: '硅基流动 (SiliconFlow)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3'],
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    iconColor: '00B4A6',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['deepseek/deepseek-chat', 'openai/gpt-4o-mini'],
    defaultModel: 'deepseek/deepseek-chat',
    iconColor: '8A3FFC',
  },
];

// ─── 厂商管理 ──────────────────────────────────────────────────

/**
 * 获取所有可用厂商（预设 + 自定义）
 */
export function getAllProviders(): AIProviderConfig[] {
  const config = readConfig();
  const custom = config.ai?.customProviders ?? [];
  return [...PROVIDER_PRESETS, ...custom];
}

/**
 * 根据 ID 查找厂商
 */
export function getProviderById(id: string): AIProviderConfig | undefined {
  return getAllProviders().find(p => p.id === id);
}

/**
 * 获取当前活跃厂商配置
 */
export function getActiveProvider(): { provider: AIProviderConfig; model: string } | null {
  const config = readConfig();
  const activeId = config.ai?.activeProvider;
  const activeModel = config.ai?.activeModel;
  if (!activeId) return null;

  const provider = getProviderById(activeId);
  if (!provider) return null;

  return { provider, model: activeModel ?? provider.defaultModel };
}

/**
 * 设置活跃厂商 + 模型
 */
export function setActiveProvider(providerId: string, model: string): void {
  const config = readConfig();
  const aiConfig: AIConfig = {
    ...config.ai,
    activeProvider: providerId,
    activeModel: model,
  };
  const updated: Config = { ...config, ai: aiConfig };
  writeConfig(updated);
}

/**
 * 添加自定义厂商
 */
export function addCustomProvider(provider: AIProviderConfig): void {
  const config = readConfig();
  const custom = config.ai?.customProviders ?? [];
  if (custom.some(p => p.id === provider.id)) {
    throw new Error(`厂商 ID "${provider.id}" 已存在`);
  }
  custom.push({ ...provider, custom: true });
  const updated: Config = {
    ...config,
    ai: { ...config.ai, customProviders: custom },
  };
  writeConfig(updated);
}

/**
 * 删除自定义厂商
 */
export function removeCustomProvider(providerId: string): void {
  const config = readConfig();
  const custom = (config.ai?.customProviders ?? []).filter(p => p.id !== providerId);
  const updated: Config = {
    ...config,
    ai: { ...config.ai, customProviders: custom },
  };
  writeConfig(updated);
}

// ─── API Key 管理 ──────────────────────────────────────────────

function apiKeyField(providerId: string): string {
  return `AI_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_KEY`;
}

/**
 * 获取厂商的 API Key
 */
export function getApiKey(providerId: string): string | null {
  const secrets = readSecrets();
  const field = apiKeyField(providerId);
  return secrets[field] ?? null;
}

/**
 * 设置厂商的 API Key
 */
export function setApiKey(providerId: string, key: string): void {
  const secrets = readSecrets();
  secrets[apiKeyField(providerId)] = key;
  writeSecrets(secrets);
}

/**
 * 删除厂商的 API Key
 */
export function removeApiKey(providerId: string): void {
  const secrets = readSecrets();
  delete secrets[apiKeyField(providerId)];
  writeSecrets(secrets);
}

/**
 * 检查厂商是否已配置 API Key
 */
export function hasApiKey(providerId: string): boolean {
  return getApiKey(providerId) !== null;
}

// ─── Commit 消息生成 ───────────────────────────────────────────

/**
 * 调用 AI 生成 commit 消息
 *
 * 使用 OpenAI-compatible chat completions API
 */
export async function generateCommitMessage(diff: string, changedFiles: string[]): Promise<string> {
  const active = getActiveProvider();
  if (!active) {
    throw new Error('未配置 AI 厂商，请在设置页面配置');
  }

  const apiKey = getApiKey(active.provider.id);
  if (!apiKey) {
    throw new Error(`厂商 ${active.provider.name} 未设置 API Key`);
  }

  // 截断 diff 避免超出 context window
  const maxDiffLength = 8000;
  const truncatedDiff = diff.length > maxDiffLength
    ? diff.substring(0, maxDiffLength) + '\n...(diff 截断)'
    : diff;

  const fileSummary = changedFiles.length > 0
    ? changedFiles.map(f => `  - ${f}`).join('\n')
    : '(无文件变更)';

  const systemPrompt = `你是一个 Git 提交消息生成助手。根据 git diff 生成简洁、准确的提交消息。
规则：
1. 格式: "type: 简短描述"
2. type 选择: feat(新功能) | fix(修复) | refactor(重构) | docs(文档) | chore(杂项) | style(样式) | test(测试)
3. 描述用中文，不超过 50 字
4. 只输出提交消息本身，不要任何其他内容`;

  const userPrompt = `变更文件列表:
${fileSummary}

Git diff:
${truncatedDiff}

请生成提交消息：`;

  const url = `${active.provider.baseUrl}/chat/completions`;
  const body = {
    model: active.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 100,
    temperature: 0.3,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI API 错误 (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI 返回为空');
  }

  // 清理可能的引号和换行
  return content.trim().replace(/^["']|["']$/g, '');
}
