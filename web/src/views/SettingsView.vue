<template>
  <div class="app-page settings-page">
    <div class="page-title-row">
      <h1 class="page-title">设置</h1>
      <n-button size="small" quaternary @click="refreshAll" :loading="loading">
        刷新
      </n-button>
    </div>

    <n-spin :show="loading">
      <!-- ─── Git 平台身份凭证 ─── -->
      <div class="section-card">
        <div class="section-header">
          <n-icon size="18" class="section-icon"><KeyOutline /></n-icon>
          <span class="section-title">Git 平台身份凭证</span>
          <n-dropdown :options="bindOptions" @select="handleBindSelect">
            <n-button size="small" type="primary">
              <template #icon>
                <n-icon><AddOutline /></n-icon>
              </template>
              绑定
            </n-button>
          </n-dropdown>
        </div>
        <p class="section-desc">用于在 Git 仓库中提交代码和拉取代码的身份凭证</p>

        <!-- Git 平台列表 -->
        <div class="git-platform-list">
          <div
            v-for="p in gitPlatforms"
            :key="p.id"
            class="git-platform-item"
            :class="{ bound: p.configured, active: p.enabled }"
          >
            <div class="platform-icon">
              <BrandIcon :providerId="p.id" :providerName="p.name" :size="32" />
            </div>
            <div class="platform-info">
              <div class="platform-name-row">
                <span class="platform-name">{{ p.name }}</span>
                <n-tag v-if="p.configured" size="small" type="success">已绑定</n-tag>
                <n-tag v-else size="small" type="default">未绑定</n-tag>
              </div>
              <p class="platform-desc">
                <template v-if="p.configured && p.username">
                  {{ p.username }} · {{ p.baseUrl }}
                </template>
                <template v-else>
                  点击绑定 {{ p.name }} 身份，用于同步代码、提交代码等操作
                </template>
              </p>
            </div>
            <div class="platform-actions">
              <n-button
                v-if="!p.configured"
                size="small"
                @click="showBindModal(p.id)"
              >
                绑定
              </n-button>
              <n-dropdown v-else :options="getPlatformOptions(p.id)" @select="(key) => handlePlatformAction(p.id, key)">
                <n-button size="small" quaternary>
                  <n-icon><MedicalOutline /></n-icon>
                </n-button>
              </n-dropdown>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── 网络代理设置 ─── -->
      <div class="section-card">
        <div class="section-header">
          <n-icon size="18" class="section-icon"><GlobeOutline /></n-icon>
          <span class="section-title">网络代理</span>
        </div>
        <p class="section-desc">配置网络代理用于 GitHub 同步等网络请求</p>

        <div class="proxy-settings">
          <n-switch v-model:value="proxyEnabled" @update:value="onProxyToggle">
          </n-switch>

          <n-input-group v-if="proxyEnabled" style="margin-top: 12px;">
            <n-input
              v-model:value="proxyUrl"
              placeholder="http://127.0.0.1:7890"
              size="small"
              style="flex: 1"
            />
            <n-button size="small" type="primary" @click="saveProxy" :loading="savingProxy">
              保存
            </n-button>
          </n-input-group>

          <p v-if="proxyEnabled" class="proxy-hint">
            支持 HTTP/HTTPS 代理，如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080
          </p>
        </div>
      </div>

      <!-- ─── AI Commit 消息生成 ─── -->
      <div class="section-card">
        <div class="section-header">
          <n-icon size="18" class="section-icon"><SparklesOutline /></n-icon>
          <span class="section-title">AI Commit 消息生成</span>
        </div>
        <p class="section-desc">配置大模型 API，在推送时自动生成 commit 消息。所有厂商使用 OpenAI 兼容格式。</p>

        <!-- Active provider banner -->
        <div v-if="activeProvider" class="active-banner">
          <BrandIcon :providerId="activeProvider.id" :providerName="activeProvider.name" :iconColor="activeProvider.iconColor" :size="32" />
          <div class="active-info">
            <span class="active-name">{{ activeProvider.name }}</span>
            <span class="active-model">{{ activeModel }}</span>
          </div>
          <span class="active-badge">已启用</span>
        </div>
        <div v-else class="no-active-hint">
          <n-icon size="14" class="hint-icon"><AlertCircleOutline /></n-icon>
          <span>尚未启用 AI 厂商，请在下方选择一个并配置 API Key</span>
        </div>
      </div>

      <!-- ─── Provider List ─── -->
      <div class="provider-list">
        <div
          v-for="p in providers"
          :key="p.id"
          class="provider-card"
          :class="{ active: p.isActive }"
        >
          <div class="provider-top">
            <BrandIcon :providerId="p.id" :providerName="p.name" :iconColor="p.iconColor" :size="36" />
            <div class="provider-meta">
              <span class="provider-name">{{ p.name }}</span>
              <span v-if="p.custom" class="custom-tag">自定义</span>
              <span class="provider-url">{{ p.baseUrl }}</span>
            </div>
            <div class="provider-status">
              <span v-if="p.hasKey" class="status-key configured">
                <n-icon size="12"><CheckmarkCircle /></n-icon> 已配置
              </span>
              <span v-else class="status-key unconfigured">
                <n-icon size="12"><CloseCircle /></n-icon> 未配置
              </span>
            </div>
          </div>

          <div class="provider-controls">
            <n-input-group>
              <n-input
                v-model:value="keyInputs[p.id]"
                :type="showKey[p.id] ? 'text' : 'password'"
                placeholder="输入 API Key..."
                size="small"
                style="flex: 1"
              />
              <n-button size="small" quaternary @click="showKey[p.id] = !showKey[p.id]">
                <n-icon size="14"><EyeOutline v-if="!showKey[p.id]" /><EyeOffOutline v-else /></n-icon>
              </n-button>
              <n-button size="small" type="primary" @click="saveKey(p.id)" :loading="savingKey[p.id]">
                保存
              </n-button>
            </n-input-group>

            <n-select
              v-if="p.hasKey"
              v-model:value="modelSelections[p.id]"
              :options="p.models.map(m => ({ label: m, value: m }))"
              size="small"
              style="width: 200px"
              placeholder="选择模型"
            />

            <n-button
              v-if="p.hasKey"
              size="small"
              :type="p.isActive ? 'success' : 'default'"
              @click="activateProvider(p)"
              :loading="activatingId === p.id"
            >
              {{ p.isActive ? '当前启用' : '启用此厂商' }}
            </n-button>

            <n-button
              v-if="p.hasKey && !p.isActive"
              size="small"
              quaternary
              @click="clearKey(p.id)"
            >
              清除 Key
            </n-button>

            <n-button
              v-if="p.custom"
              size="small"
              quaternary
              type="error"
              @click="deleteCustom(p.id)"
            >
              删除
            </n-button>
          </div>
        </div>
      </div>

      <!-- ─── Add Custom Provider ─── -->
      <div class="section-card" style="margin-top: 14px">
        <div class="section-header">
          <n-icon size="18" class="section-icon"><AddCircleOutline /></n-icon>
          <span class="section-title">添加自定义厂商</span>
        </div>
        <div class="custom-form">
          <n-input v-model:value="newProvider.name" placeholder="厂商名称" size="small" />
          <n-input v-model:value="newProvider.id" placeholder="厂商 ID（英文，如 my-llm）" size="small" />
          <n-input v-model:value="newProvider.baseUrl" placeholder="API Base URL（如 https://api.example.com/v1）" size="small" />
          <n-input v-model:value="newProvider.modelsStr" placeholder="模型列表（逗号分隔，如 model-a, model-b）" size="small" />
          <n-input v-model:value="newProvider.iconColor" placeholder="品牌色 hex（可选，如 4D6BFE）" size="small" />
          <n-button size="small" type="primary" @click="addProvider" :loading="addingCustom">
            添加
          </n-button>
        </div>
      </div>
    </n-spin>

    <!-- ─── 绑定 Token Modal ─── -->
    <n-modal
      v-model:show="bindModalVisible"
      :title="`绑定 ${bindPlatform === 'github' ? 'GitHub' : 'Gitee'}`"
      preset="card"
      style="width: 420px"
    >
      <div class="bind-modal-content">
        <p class="bind-desc">
          请输入 {{ bindPlatform === 'github' ? 'GitHub' : 'Gitee' }} Personal Access Token
        </p>
        <n-input
          v-model:value="bindToken"
          type="password"
          placeholder="输入 Token..."
          size="large"
        />
        <p class="bind-hint">
          <n-icon size="14" class="info-icon"><InformationCircleOutline /></n-icon>
          <span>
            在 {{ bindPlatform === 'github' ? 'GitHub Settings > Developer settings > Personal access tokens' : 'Gitee 设置 > 私人令牌' }} 中生成
          </span>
        </p>
        <div class="bind-actions">
          <n-button @click="bindModalVisible = false">取消</n-button>
          <n-button type="primary" @click="confirmBind" :loading="binding">绑定</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { NDropdown, useMessage,NSwitch } from 'naive-ui';
import type { DropdownOption } from 'naive-ui';
import {
  SparklesOutline, AlertCircleOutline, CheckmarkCircle, CloseCircle,
  EyeOutline, EyeOffOutline, AddCircleOutline, KeyOutline,
  GlobeOutline, AddOutline, MedicalOutline, InformationCircleOutline,
} from '@vicons/ionicons5';
import BrandIcon from '../components/brand-icon.vue';
import { api, type AIProviderInfo, type GitPlatformInfo } from '../api';

const message = useMessage();
const loading = ref(false);
const providers = ref<AIProviderInfo[]>([]);
const activeProvider = ref<AIProviderInfo | null>(null);
const activeModel = ref<string>('');

// Git 平台
const gitPlatforms = ref<GitPlatformInfo[]>([]);
const activeGitPlatform = ref<'github' | 'gitee' | null>(null);

// 绑定 Modal
const bindModalVisible = ref(false);
const bindPlatform = ref<'github' | 'gitee'>('github');
const bindToken = ref('');
const binding = ref(false);

// 代理设置
const proxyEnabled = ref(false);
const proxyUrl = ref('');
const savingProxy = ref(false);

const keyInputs = reactive<Record<string, string>>({});
const showKey = reactive<Record<string, boolean>>({});
const savingKey = reactive<Record<string, boolean>>({});
const modelSelections = reactive<Record<string, string>>({});
const activatingId = ref<string | null>(null);
const addingCustom = ref(false);

const newProvider = reactive({
  name: '', id: '', baseUrl: '', modelsStr: '', iconColor: '',
});

// 绑定下拉选项
const bindOptions = computed<DropdownOption[]>(() => [
  { label: '绑定 GitHub', key: 'github' },
  { label: '绑定 Gitee', key: 'gitee' },
]);

// 获取平台操作选项
function getPlatformOptions(platform: string): DropdownOption[] {
  const p = gitPlatforms.value.find(x => x.id === platform);
  if (!p) return [];

  const options: DropdownOption[] = [
    { label: '重新绑定', key: 'rebind' },
    { label: '解除绑定', key: 'unbind' },
  ];

  if (!p.enabled) {
    options.unshift({ label: '设为当前平台', key: 'activate' });
  } else {
    options.unshift({ label: '当前使用中', key: 'current', disabled: true });
  }

  return options;
}

async function refreshAll() {
  loading.value = true;
  try {
    await Promise.all([refreshAIProviders(), refreshGitPlatforms(), refreshProxy()]);
  } finally {
    loading.value = false;
  }
}

async function refreshAIProviders() {
  const res = await api.getAIProviders();
  providers.value = res.providers;
  const active = res.providers.find(p => p.isActive);
  activeProvider.value = active ?? null;
  activeModel.value = res.activeModel ?? '';
  for (const p of res.providers) {
    if (!(p.id in modelSelections)) {
      modelSelections[p.id] = p.isActive ? res.activeModel! : p.defaultModel;
    }
  }
}

async function refreshGitPlatforms() {
  const res = await api.getGitPlatforms();
  gitPlatforms.value = res.platforms;
  activeGitPlatform.value = res.active;
}

async function refreshProxy() {
  const config = await api.getProxyConfig();
  proxyEnabled.value = config.enabled;
  proxyUrl.value = config.url || '';
}

// Git 平台操作
function handleBindSelect(key: string) {
  showBindModal(key as 'github' | 'gitee');
}

function showBindModal(platform: 'github' | 'gitee') {
  bindPlatform.value = platform;
  bindToken.value = '';
  bindModalVisible.value = true;
}

async function confirmBind() {
  if (!bindToken.value.trim()) {
    message.warning('请输入 Token');
    return;
  }

  binding.value = true;
  try {
    await api.setGitPlatformToken(bindPlatform.value, bindToken.value.trim());
    message.success(`${bindPlatform.value === 'github' ? 'GitHub' : 'Gitee'} 绑定成功`);
    bindModalVisible.value = false;
    await refreshGitPlatforms();
  } catch (e) {
    message.error(`绑定失败: ${(e as Error).message}`);
  } finally {
    binding.value = false;
  }
}

async function handlePlatformAction(platform: string, action: string) {
  switch (action) {
    case 'activate':
      try {
        await api.enableGitPlatform(platform, true);
        message.success(`已切换到 ${platform === 'github' ? 'GitHub' : 'Gitee'}`);
        await refreshGitPlatforms();
      } catch (e) {
        message.error(`切换失败: ${(e as Error).message}`);
      }
      break;
    case 'rebind':
      showBindModal(platform as 'github' | 'gitee');
      break;
    case 'unbind':
      try {
        await api.removeGitPlatformToken(platform);
        message.success('已解除绑定');
        await refreshGitPlatforms();
      } catch (e) {
        message.error(`解除绑定失败: ${(e as Error).message}`);
      }
      break;
  }
}

// 代理操作
async function onProxyToggle(enabled: boolean) {
  if (!enabled) {
    // 禁用时直接保存
    try {
      await api.setProxyConfig(false);
      message.success('代理已禁用');
    } catch (e) {
      message.error(`保存失败: ${(e as Error).message}`);
      proxyEnabled.value = true;
    }
  }
}

async function saveProxy() {
  if (proxyEnabled.value && !proxyUrl.value.trim()) {
    message.warning('请输入代理地址');
    return;
  }

  savingProxy.value = true;
  try {
    await api.setProxyConfig(proxyEnabled.value, proxyUrl.value.trim() || undefined);
    message.success('代理配置已保存');
  } catch (e) {
    message.error(`保存失败: ${(e as Error).message}`);
  } finally {
    savingProxy.value = false;
  }
}

async function saveKey(providerId: string) {
  const key = keyInputs[providerId]?.trim();
  if (!key) { message.warning('请输入 API Key'); return; }
  savingKey[providerId] = true;
  try {
    await api.setAPIKey(providerId, key);
    message.success('API Key 已保存');
    keyInputs[providerId] = '';
    await refreshAIProviders();
  } catch (e) {
    message.error(`保存失败: ${(e as Error).message}`);
  } finally {
    savingKey[providerId] = false;
  }
}

async function clearKey(providerId: string) {
  try {
    await api.removeAPIKey(providerId);
    message.success('已清除 API Key');
    await refreshAIProviders();
  } catch (e) {
    message.error(`清除失败: ${(e as Error).message}`);
  }
}

async function activateProvider(p: AIProviderInfo) {
  const model = modelSelections[p.id] ?? p.defaultModel;
  activatingId.value = p.id;
  try {
    await api.setActiveProvider(p.id, model);
    message.success(`已启用 ${p.name} (${model})`);
    await refreshAIProviders();
  } catch (e) {
    message.error(`启用失败: ${(e as Error).message}`);
  } finally {
    activatingId.value = null;
  }
}

async function addProvider() {
  if (!newProvider.name || !newProvider.id || !newProvider.baseUrl) {
    message.warning('请填写名称、ID 和 Base URL');
    return;
  }
  const models = newProvider.modelsStr.split(',').map(s => s.trim()).filter(Boolean);
  if (models.length === 0) { message.warning('请至少填写一个模型'); return; }
  addingCustom.value = true;
  try {
    await api.addCustomProvider({
      id: newProvider.id, name: newProvider.name, baseUrl: newProvider.baseUrl,
      models, defaultModel: models[0]!,
      iconColor: newProvider.iconColor || undefined,
    });
    message.success('自定义厂商已添加');
    newProvider.name = ''; newProvider.id = ''; newProvider.baseUrl = '';
    newProvider.modelsStr = ''; newProvider.iconColor = '';
    await refreshAIProviders();
  } catch (e) {
    message.error(`添加失败: ${(e as Error).message}`);
  } finally {
    addingCustom.value = false;
  }
}

async function deleteCustom(providerId: string) {
  try {
    await api.removeCustomProvider(providerId);
    message.success('已删除自定义厂商');
    await refreshAIProviders();
  } catch (e) {
    message.error(`删除失败: ${(e as Error).message}`);
  }
}

onMounted(() => refreshAll());
</script>

<style scoped>
.settings-page { max-width: 52rem; margin: 0 auto; }
.page-title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-lg); margin-bottom: var(--space-sm); }
.page-title { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: 600; letter-spacing: -0.04em; }

.section-card {
  padding: var(--space-lg); border-radius: var(--radius-lg);
  background: var(--surface);
  border: var(--rule);
  box-shadow: none;
  margin-bottom: var(--space-md);
}
.section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.section-icon { color: var(--text-2); }
.section-title { font-size: 14px; font-weight: 600; color: var(--text); }
.section-desc { font-size: 13px; color: var(--text-2); margin: 0 0 14px; }

/* ─── Git 平台身份凭证 ───────────────────────────────────────────── */
.git-platform-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.git-platform-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.git-platform-item.bound {
  background: var(--surface);
}

.git-platform-item.active {
  border-color: color-mix(in srgb, var(--success) 35%, var(--border));
  background: color-mix(in srgb, var(--success) 6%, var(--surface));
}

.platform-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-hover);
}

.platform-info {
  flex: 1;
  min-width: 0;
}

.platform-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.platform-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.platform-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-3);
}

.platform-actions {
  flex-shrink: 0;
}

/* ─── 代理设置 ───────────────────────────────────────────────────── */
.proxy-settings {
  padding: 4px 0;
}

.proxy-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-3);
}

/* ─── 绑定 Modal ─────────────────────────────────────────────────── */
.bind-modal-content {
  padding: 8px 0;
}

.bind-desc {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--text);
}

.bind-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--text-3);
}

.bind-hint span {
  flex: 1;
}

.bind-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

/* ─── AI 提供商 ──────────────────────────────────────────────────── */
.active-banner {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 10px;
  background: color-mix(in srgb, var(--success) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 28%, transparent);
}
.active-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.active-name { font-size: 14px; font-weight: 600; color: var(--text); }
.active-model { font-size: 12px; color: var(--text-3); font-family: var(--font-mono); }
.active-badge {
  font-size: 11px; font-weight: 600;
  color: var(--color-success);
  background: color-mix(in srgb, var(--success) 14%, transparent);
  padding: 2px 8px; border-radius: 4px;
}

.no-active-hint { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--warning); }
.hint-icon { color: var(--warning); }

.provider-list { display: flex; flex-direction: column; gap: 10px; }
.provider-card {
  padding: 14px 16px; border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s ease;
}
.provider-card.active {
  border-color: color-mix(in srgb, var(--success) 35%, var(--border));
}

.provider-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.provider-meta { flex: 1; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.provider-name { font-size: 14px; font-weight: 600; color: var(--text); }
.custom-tag {
  font-size: 10px; color: var(--accent);
  background: var(--accent-soft); padding: 1px 6px; border-radius: 4px;
}
.provider-url { font-size: 11px; color: var(--text-3); font-family: var(--font-mono); width: 100%; }

.provider-status { flex-shrink: 0; }
.status-key { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.status-key.configured { color: var(--success); }
.status-key.unconfigured { color: var(--warning); }

.provider-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.custom-form { display: flex; flex-wrap: wrap; gap: 8px; }
.custom-form .n-input { width: 200px; }

.info-icon { color: var(--color-muted); }
</style>
