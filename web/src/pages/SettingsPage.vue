<template>
  <div class="settings-page">
    <div class="page-header">
      <h3>设置</h3>
      <n-button size="small" quaternary @click="refresh" :loading="loading">
        刷新
      </n-button>
    </div>

    <n-spin :show="loading">
      <!-- ─── AI Commit 消息生成 ─── -->
      <div class="section-card">
        <div class="section-header">
          <n-icon size="18" color="#007AFF"><SparklesOutline /></n-icon>
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
          <n-icon size="14" color="#FF9500"><AlertCircleOutline /></n-icon>
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
          <n-icon size="18" color="#5856D6"><AddCircleOutline /></n-icon>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useMessage } from 'naive-ui';
import {
  SparklesOutline, AlertCircleOutline, CheckmarkCircle, CloseCircle,
  EyeOutline, EyeOffOutline, AddCircleOutline,
} from '@vicons/ionicons5';
import BrandIcon from '../components/brand-icon.vue';
import { api, type AIProviderInfo } from '../api';

const message = useMessage();
const loading = ref(false);
const providers = ref<AIProviderInfo[]>([]);
const activeProvider = ref<AIProviderInfo | null>(null);
const activeModel = ref<string>('');

const keyInputs = reactive<Record<string, string>>({});
const showKey = reactive<Record<string, boolean>>({});
const savingKey = reactive<Record<string, boolean>>({});
const modelSelections = reactive<Record<string, string>>({});
const activatingId = ref<string | null>(null);
const addingCustom = ref(false);

const newProvider = reactive({
  name: '', id: '', baseUrl: '', modelsStr: '', iconColor: '',
});

async function refresh() {
  loading.value = true;
  try {
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
  } catch (e) {
    message.error(`加载失败: ${(e as Error).message}`);
  } finally {
    loading.value = false;
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
    await refresh();
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
    await refresh();
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
    await refresh();
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
    await refresh();
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
    await refresh();
  } catch (e) {
    message.error(`删除失败: ${(e as Error).message}`);
  }
}

onMounted(() => refresh());
</script>

<style scoped>
.settings-page { max-width: 720px; margin: 0 auto; }

.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.page-header h3 {
  margin: 0; font-size: 17px; font-weight: 700; color: #1d1d1f; letter-spacing: -0.01em;
}

.section-card {
  padding: 18px 20px; border-radius: 16px;
  background: rgba(255,255,255,0.65); backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.7); box-shadow: 0 1px 4px rgba(0,0,0,0.03);
  margin-bottom: 14px;
}
.section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.section-title { font-size: 15px; font-weight: 600; color: #1d1d1f; }
.section-desc { font-size: 13px; color: #86868b; margin: 0 0 14px; }

.active-banner {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-radius: 12px;
  background: rgba(52,199,89,0.08); border: 1px solid rgba(52,199,89,0.15);
}
.active-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.active-name { font-size: 15px; font-weight: 600; color: #1d1d1f; }
.active-model { font-size: 12px; color: #86868b; font-family: 'SF Mono', Monaco, monospace; }
.active-badge { font-size: 11px; font-weight: 600; color: #248a3d; background: rgba(52,199,89,0.15); padding: 2px 8px; border-radius: 6px; }

.no-active-hint { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #c26e00; }

.provider-list { display: flex; flex-direction: column; gap: 10px; }
.provider-card {
  padding: 16px; border-radius: 14px;
  background: rgba(255,255,255,0.50); border: 1px solid rgba(255,255,255,0.6);
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  transition: border-color 0.15s ease;
}
.provider-card.active { border-color: rgba(52,199,89,0.25); }

.provider-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.provider-meta { flex: 1; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.provider-name { font-size: 14px; font-weight: 600; color: #1d1d1f; }
.custom-tag { font-size: 10px; color: #5856d6; background: rgba(88,86,214,0.10); padding: 1px 6px; border-radius: 4px; }
.provider-url { font-size: 11px; color: #86868b; font-family: 'SF Mono', Monaco, monospace; width: 100%; }

.provider-status { flex-shrink: 0; }
.status-key { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.status-key.configured { color: #248a3d; }
.status-key.unconfigured { color: #c26e00; }

.provider-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.custom-form { display: flex; flex-wrap: wrap; gap: 8px; }
.custom-form .n-input { width: 200px; }
</style>
