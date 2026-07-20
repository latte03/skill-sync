<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import { useToast } from '../composables/useToast';
import {
  AddOutline,
  AlertCircleOutline,
  CheckmarkCircle,
  ChevronForwardOutline,
  CloseCircle,
  EyeOffOutline,
  EyeOutline,
  GlobeOutline,
  InformationCircleOutline,
  KeyOutline,
  MedicalOutline,
  RefreshOutline,
  SparklesOutline,
} from '@vicons/ionicons5';
import BrandIcon from '../components/brand-icon.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import UiButton from '../components/ui/UiButton.vue';
import UiDialog from '../components/ui/UiDialog.vue';
import UiDropdown from '../components/ui/UiDropdown.vue';
import type { UiDropdownOption } from '../components/ui/UiDropdown.vue';
import UiInput from '../components/ui/UiInput.vue';
import UiSelect from '../components/ui/UiSelect.vue';
import UiSpin from '../components/ui/UiSpin.vue';
import UiSwitch from '../components/ui/UiSwitch.vue';
import UiIcon from '../components/ui/UiIcon.vue';
import { api } from '../api';
import type { AIProviderInfo, GitPlatformInfo } from '../api';

const message = useToast();
const loading = shallowRef(false);
const providers = ref<AIProviderInfo[]>([]);
const activeProvider = shallowRef<AIProviderInfo | null>(null);
const activeModel = shallowRef('');
const selectedProviderId = shallowRef<string | null>(null);
const providerPickerVisible = shallowRef(false);
const customModalVisible = shallowRef(false);

const gitPlatforms = ref<GitPlatformInfo[]>([]);
const bindModalVisible = shallowRef(false);
const bindPlatform = shallowRef<'github' | 'gitee'>('github');
const bindToken = shallowRef('');
const binding = shallowRef(false);

const proxyEnabled = shallowRef(false);
const proxyUrl = shallowRef('');
const savingProxy = shallowRef(false);
const keyInputs = reactive<Record<string, string>>({});
const showKey = reactive<Record<string, boolean>>({});
const savingKey = reactive<Record<string, boolean>>({});
const modelSelections = reactive<Record<string, string>>({});
const activatingId = shallowRef<string | null>(null);
const addingCustom = shallowRef(false);
const newProvider = reactive({ name: '', id: '', baseUrl: '', modelsStr: '', iconColor: '' });

const selectedProvider = computed(() => providers.value.find(provider => provider.id === selectedProviderId.value) ?? null);
const providerModalVisible = computed({ get: () => selectedProvider.value !== null, set: value => { if (!value) selectedProviderId.value = null; } });
const bindOptions = computed<UiDropdownOption[]>(() => [
  { label: '绑定 GitHub', key: 'github' },
  { label: '绑定 Gitee', key: 'gitee' },
]);

function getPlatformOptions(platform: string): UiDropdownOption[] {
  const item = gitPlatforms.value.find(value => value.id === platform);
  if (!item) return [];
  const options: UiDropdownOption[] = [{ label: '重新绑定', key: 'rebind' }, { label: '解除绑定', key: 'unbind' }];
  options.unshift(item.enabled ? { label: '当前使用中', key: 'current', disabled: true } : { label: '设为当前平台', key: 'activate' });
  return options;
}

async function refreshAll() {
  loading.value = true;
  try { await Promise.all([refreshAIProviders(), refreshGitPlatforms(), refreshProxy()]); }
  finally { loading.value = false; }
}
async function refreshAIProviders() {
  const response = await api.getAIProviders();
  providers.value = response.providers;
  activeProvider.value = response.providers.find(provider => provider.isActive) ?? null;
  activeModel.value = response.activeModel ?? '';
  for (const provider of response.providers) {
    if (!(provider.id in modelSelections)) modelSelections[provider.id] = provider.isActive ? response.activeModel! : provider.defaultModel;
  }
}
async function refreshGitPlatforms() { gitPlatforms.value = (await api.getGitPlatforms()).platforms; }
async function refreshProxy() { const config = await api.getProxyConfig(); proxyEnabled.value = config.enabled; proxyUrl.value = config.url || ''; }

function showBindModal(platform: 'github' | 'gitee') { bindPlatform.value = platform; bindToken.value = ''; bindModalVisible.value = true; }
function handleBindSelect(key: string) { showBindModal(key as 'github' | 'gitee'); }
async function confirmBind() {
  if (!bindToken.value.trim()) { message.warning('请输入 Token'); return; }
  binding.value = true;
  try { await api.setGitPlatformToken(bindPlatform.value, bindToken.value.trim()); message.success('平台凭证绑定成功'); bindModalVisible.value = false; await refreshGitPlatforms(); }
  catch (error) { message.error(`绑定失败: ${(error as Error).message}`); }
  finally { binding.value = false; }
}
async function handlePlatformAction(platform: string, action: string) {
  try {
    if (action === 'activate') { await api.enableGitPlatform(platform, true); message.success('当前 Git 平台已切换'); }
    if (action === 'rebind') { showBindModal(platform as 'github' | 'gitee'); return; }
    if (action === 'unbind') { await api.removeGitPlatformToken(platform); message.success('已解除绑定'); }
    await refreshGitPlatforms();
  } catch (error) { message.error(`操作失败: ${(error as Error).message}`); }
}
async function onProxyToggle(enabled: boolean) {
  if (enabled) return;
  try { await api.setProxyConfig(false); message.success('代理已禁用'); }
  catch (error) { message.error(`保存失败: ${(error as Error).message}`); proxyEnabled.value = true; }
}
async function saveProxy() {
  if (proxyEnabled.value && !proxyUrl.value.trim()) { message.warning('请输入代理地址'); return; }
  savingProxy.value = true;
  try { await api.setProxyConfig(proxyEnabled.value, proxyUrl.value.trim() || undefined); message.success('代理配置已保存'); }
  catch (error) { message.error(`保存失败: ${(error as Error).message}`); }
  finally { savingProxy.value = false; }
}
async function saveKey(providerId: string) {
  const key = keyInputs[providerId]?.trim();
  if (!key) { message.warning('请输入 API Key'); return; }
  savingKey[providerId] = true;
  try { await api.setAPIKey(providerId, key); keyInputs[providerId] = ''; message.success('API Key 已保存'); await refreshAIProviders(); }
  catch (error) { message.error(`保存失败: ${(error as Error).message}`); }
  finally { savingKey[providerId] = false; }
}
async function clearKey(providerId: string) {
  try { await api.removeAPIKey(providerId); message.success('API Key 已清除'); await refreshAIProviders(); }
  catch (error) { message.error(`清除失败: ${(error as Error).message}`); }
}
async function activateProvider(provider: AIProviderInfo) {
  const model = modelSelections[provider.id] ?? provider.defaultModel;
  activatingId.value = provider.id;
  try { await api.setActiveProvider(provider.id, model); message.success(`已启用 ${provider.name}`); await refreshAIProviders(); }
  catch (error) { message.error(`启用失败: ${(error as Error).message}`); }
  finally { activatingId.value = null; }
}
async function addProvider() {
  if (!newProvider.name || !newProvider.id || !newProvider.baseUrl) { message.warning('请填写名称、ID 和 Base URL'); return; }
  const models = newProvider.modelsStr.split(',').map(value => value.trim()).filter(Boolean);
  if (!models.length) { message.warning('请至少填写一个模型'); return; }
  addingCustom.value = true;
  try {
    await api.addCustomProvider({ id: newProvider.id, name: newProvider.name, baseUrl: newProvider.baseUrl, models, defaultModel: models[0]!, iconColor: newProvider.iconColor || undefined });
    Object.assign(newProvider, { name: '', id: '', baseUrl: '', modelsStr: '', iconColor: '' });
    customModalVisible.value = false; message.success('自定义厂商已添加'); await refreshAIProviders();
  } catch (error) { message.error(`添加失败: ${(error as Error).message}`); }
  finally { addingCustom.value = false; }
}
async function deleteCustom(providerId: string) {
  try { await api.removeCustomProvider(providerId); selectedProviderId.value = null; message.success('自定义厂商已删除'); await refreshAIProviders(); }
  catch (error) { message.error(`删除失败: ${(error as Error).message}`); }
}

onMounted(refreshAll);
</script>

<template>
  <div class="settings-page">
    <PageHeader title="设置" summary="管理 Git 凭证、网络代理和 AI Commit 厂商。">
      <template #actions>
        <UiButton size="sm" :loading="loading" @click="refreshAll">
          <template #icon><UiIcon :component="RefreshOutline" size="15" /></template>
          刷新
        </UiButton>
      </template>
    </PageHeader>

    <UiSpin :show="loading">
      <div class="settings-stack">
        <!-- Git 平台凭证 -->
        <section class="settings-card">
          <header class="card-header">
            <span class="card-icon"><UiIcon :component="KeyOutline" size="17" /></span>
            <div class="card-title">
              <h2>Git 平台凭证</h2>
              <p>用于远程同步、提交和拉取代码。</p>
            </div>
            <UiDropdown :options="bindOptions" @select="handleBindSelect">
              <UiButton variant="primary" size="sm"><template #icon><UiIcon :component="AddOutline" /></template>绑定平台</UiButton>
            </UiDropdown>
          </header>
          <div class="card-body">
            <div class="platform-list">
              <article v-for="platform in gitPlatforms" :key="platform.id" :class="{ active: platform.enabled }">
                <BrandIcon :provider-id="platform.id" :provider-name="platform.name" :size="32" />
                <div class="platform-info">
                  <b>{{ platform.name }}</b>
                </div>
                <em :class="platform.configured ? 'ok' : ''">{{ platform.configured ? '已绑定' : '未绑定' }}</em>
                <UiButton v-if="!platform.configured" size="sm" @click="showBindModal(platform.id as 'github' | 'gitee')">绑定</UiButton>
                <UiDropdown v-else :options="getPlatformOptions(platform.id)" @select="handlePlatformAction(platform.id, $event)">
                  <UiButton variant="ghost" size="sm"><template #icon><UiIcon :component="MedicalOutline" /></template></UiButton>
                </UiDropdown>
              </article>
            </div>
          </div>
        </section>

        <!-- 网络代理 -->
        <section class="settings-card">
          <header class="card-header">
            <span class="card-icon"><UiIcon :component="GlobeOutline" size="17" /></span>
            <div class="card-title">
              <h2>网络代理</h2>
              <p>应用于 GitHub 与模型 API 请求。</p>
            </div>
            <UiSwitch v-model="proxyEnabled" aria-label="启用网络代理" @update:model-value="onProxyToggle" />
          </header>
          <div class="card-body">
            <div v-if="proxyEnabled" class="proxy-form">
              <UiInput v-model="proxyUrl" placeholder="http://127.0.0.1:7890" />
              <UiButton variant="primary" size="sm" :loading="savingProxy" @click="saveProxy">保存</UiButton>
              <small>支持 HTTP、HTTPS 与 SOCKS5 代理。</small>
            </div>
            <p v-else class="proxy-hint">当前跟随系统网络设置。启用后可为 GitHub 与模型请求指定代理地址。</p>
          </div>
        </section>

        <!-- AI Commit 厂商 -->
        <section class="settings-card">
          <header class="card-header">
            <span class="card-icon"><UiIcon :component="SparklesOutline" size="17" /></span>
            <div class="card-title">
              <h2>AI Commit 厂商</h2>
              <p>已接入 {{ providers.length }} 个模型服务，选择并配置 API Key。</p>
            </div>
            <UiButton size="sm" @click="customModalVisible = true"><template #icon><UiIcon :component="AddOutline" /></template>自定义厂商</UiButton>
          </header>
          <div class="card-body">
            <button v-if="activeProvider" class="active-provider" type="button" @click="providerPickerVisible = true">
              <BrandIcon :provider-id="activeProvider.id" :provider-name="activeProvider.name" :icon-color="activeProvider.iconColor" :size="36" />
              <div class="active-provider-info">
                <span>当前启用</span>
                <b>{{ activeProvider.name }}</b>
                <small>{{ activeModel }}</small>
              </div>
              <em>运行中</em>
              <UiIcon :component="ChevronForwardOutline" size="16" class="active-provider-chevron" />
            </button>
            <button v-else class="provider-notice" type="button" @click="providerPickerVisible = true">
              <UiIcon :component="AlertCircleOutline" size="16" />
              尚未启用 AI 厂商 · 点击选择
            </button>
          </div>
        </section>
      </div>
    </UiSpin>

    <!-- Dialogs -->
    <UiDialog v-model="providerModalVisible" :title="selectedProvider ? `配置 ${selectedProvider.name}` : '配置厂商'" size="md">
      <div v-if="selectedProvider" class="provider-config">
        <div class="provider-identity">
          <BrandIcon :provider-id="selectedProvider.id" :provider-name="selectedProvider.name" :icon-color="selectedProvider.iconColor" :size="40" />
          <div><b>{{ selectedProvider.name }}</b><code>{{ selectedProvider.baseUrl }}</code></div>
          <em :class="selectedProvider.hasKey ? 'ok' : ''">{{ selectedProvider.hasKey ? '已配置' : '未配置' }}</em>
        </div>
        <label><span>API Key</span><span class="input-group"><UiInput v-model="keyInputs[selectedProvider.id]" :type="showKey[selectedProvider.id] ? 'text' : 'password'" placeholder="输入 API Key" /><UiButton @click="showKey[selectedProvider.id] = !showKey[selectedProvider.id]"><template #icon><UiIcon :component="showKey[selectedProvider.id] ? EyeOffOutline : EyeOutline" /></template></UiButton><UiButton variant="primary" :loading="savingKey[selectedProvider.id]" @click="saveKey(selectedProvider.id)">保存</UiButton></span></label>
        <label v-if="selectedProvider.hasKey"><span>模型</span><UiSelect v-model="modelSelections[selectedProvider.id]" :options="selectedProvider.models.map(model => ({ label: model, value: model }))" /></label>
        <div class="modal-actions">
          <UiButton v-if="selectedProvider.hasKey && !selectedProvider.isActive" variant="ghost" @click="clearKey(selectedProvider.id)">清除 Key</UiButton>
          <UiButton v-if="selectedProvider.custom" variant="danger" @click="deleteCustom(selectedProvider.id)">删除厂商</UiButton>
          <UiButton v-if="selectedProvider.hasKey" variant="primary" :loading="activatingId === selectedProvider.id" @click="activateProvider(selectedProvider)">{{ selectedProvider.isActive ? '保存模型选择' : '启用此厂商' }}</UiButton>
        </div>
      </div>
    </UiDialog>
    <UiDialog v-model="providerPickerVisible" title="选择 AI 厂商" size="lg">
      <div class="provider-picker">
        <button v-for="provider in providers" :key="provider.id" type="button" :class="{ active: provider.isActive }" @click="providerPickerVisible = false; selectedProviderId = provider.id">
          <BrandIcon :provider-id="provider.id" :provider-name="provider.name" :icon-color="provider.iconColor" :size="32" />
          <span><b>{{ provider.name }}</b><small>{{ provider.hasKey ? (provider.isActive ? modelSelections[provider.id] : '凭证已配置') : '等待配置 API Key' }}</small></span>
          <em :class="provider.hasKey ? 'ok' : ''"><UiIcon :component="provider.hasKey ? CheckmarkCircle : CloseCircle" size="13" />{{ provider.hasKey ? '已配置' : '未配置' }}</em>
          <UiIcon :component="ChevronForwardOutline" size="15" />
        </button>
      </div>
    </UiDialog>
    <UiDialog v-model="customModalVisible" title="添加自定义厂商" size="sm">
      <div class="custom-form">
        <UiInput v-model="newProvider.name" placeholder="厂商名称" />
        <UiInput v-model="newProvider.id" placeholder="厂商 ID，如 my-llm" />
        <UiInput v-model="newProvider.baseUrl" placeholder="API Base URL" />
        <UiInput v-model="newProvider.modelsStr" placeholder="模型列表，使用逗号分隔" />
        <UiInput v-model="newProvider.iconColor" placeholder="品牌色，可选" />
        <div class="modal-actions"><UiButton @click="customModalVisible = false">取消</UiButton><UiButton variant="primary" :loading="addingCustom" @click="addProvider">添加厂商</UiButton></div>
      </div>
    </UiDialog>
    <UiDialog v-model="bindModalVisible" :title="`绑定 ${bindPlatform === 'github' ? 'GitHub' : 'Gitee'}`" size="sm">
      <div class="bind-content">
        <p>请输入 Personal Access Token。凭证只保存在本地配置中。</p>
        <UiInput v-model="bindToken" type="password" placeholder="输入 Token" />
        <small><UiIcon :component="InformationCircleOutline" size="14" />请确保 Token 具备仓库读写权限。</small>
        <div class="modal-actions"><UiButton @click="bindModalVisible = false">取消</UiButton><UiButton variant="primary" :loading="binding" @click="confirmBind">确认绑定</UiButton></div>
      </div>
    </UiDialog>
  </div>
</template>

<style scoped>
.settings-page { width: 100%; max-width: var(--content-max-width); margin: 0 auto; padding: 1.75rem 2rem 3rem; }

.settings-stack { display: grid; margin-top: 1.25rem; }

.settings-card { padding: 1.5rem 0; }
.settings-card + .settings-card { border-top: 1px solid var(--color-rule); }

.card-header {
  display: flex;
  align-items: center;
  gap: .75rem;
}
.card-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-accent-soft);
  color: var(--color-accent);
}
.card-title { min-width: 0; flex: 1; }
.card-title h2 { margin: 0; color: var(--color-ink); font-size: var(--text-base); font-weight: 650; letter-spacing: -.01em; }
.card-title p { margin: .15rem 0 0; color: var(--color-faint); font-size: var(--text-xs); }
.card-header > :last-child { flex: none; }

.card-body { margin-top: 1rem; }

/* Platform list */
.platform-list { display: grid; border: 1px solid var(--color-rule); border-radius: var(--radius-md); overflow: hidden; }
.platform-list article {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: .85rem;
  padding: .85rem 1rem;
  transition: background var(--dur-fast);
}
.platform-list article + article { border-top: 1px solid var(--color-rule); }
.platform-list article:hover { background: var(--color-paper-2); }
.platform-list article.active { background: var(--color-success-soft); }
.platform-info { min-width: 0; }
.platform-info b { display: block; color: var(--color-ink); font-size: var(--text-sm); font-weight: 600; }
.platform-info span { display: block; margin-top: .1rem; overflow: hidden; color: var(--color-muted); font-size: var(--text-xs); text-overflow: ellipsis; white-space: nowrap; }
.platform-list em { color: var(--color-warning); font-size: var(--text-xs); font-style: normal; font-weight: 550; }
.platform-list em.ok { color: var(--color-success); }

/* Proxy */
.proxy-form { display: flex; align-items: center; gap: .625rem; }
.proxy-form small { flex-basis: 100%; color: var(--color-faint); font-size: var(--text-xs); }
.proxy-hint { margin: 0; color: var(--color-muted); font-size: var(--text-sm); line-height: 1.5; }

/* AI Provider */
.active-provider {
  display: flex;
  width: 100%;
  align-items: center;
  gap: .85rem;
  border: 1px solid color-mix(in srgb, var(--color-success) 30%, var(--color-rule));
  border-radius: var(--radius-md);
  background: var(--color-success-soft);
  padding: .85rem 1rem;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.active-provider:hover { border-color: color-mix(in srgb, var(--color-success) 50%, var(--color-rule)); background: color-mix(in srgb, var(--color-success) 14%, var(--color-paper)); }
.active-provider-info { flex: 1; min-width: 0; }
.active-provider-info span { display: block; color: var(--color-success); font-size: var(--text-xs); font-weight: 550; }
.active-provider-info b { display: block; color: var(--color-ink); font-size: var(--text-sm); font-weight: 650; }
.active-provider-info small { display: block; margin-top: .1rem; color: var(--color-muted); font-family: var(--font-mono); font-size: var(--text-xs); }
.active-provider > em { color: var(--color-success); font-size: var(--text-xs); font-style: normal; font-weight: 600; }
.active-provider-chevron { flex: none; color: var(--color-faint); }

.provider-notice {
  display: flex;
  align-items: center;
  gap: .5rem;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-warning);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: color var(--dur-fast);
}
.provider-notice:hover { color: var(--color-ink); }

/* Dialogs */
.provider-config, .custom-form, .bind-content { display: grid; gap: 1rem; }
.provider-identity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: .85rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-rule);
}
.provider-identity b { display: block; color: var(--color-ink); font-size: var(--text-base); font-weight: 650; }
.provider-identity code { display: block; margin-top: .15rem; color: var(--color-muted); font-size: var(--text-xs); overflow-wrap: anywhere; }
.provider-identity em { color: var(--color-warning); font-size: var(--text-xs); font-style: normal; font-weight: 550; }
.provider-identity em.ok { color: var(--color-success); }
.provider-config label { display: grid; gap: .4rem; }
.provider-config label > span { color: var(--color-ink-2); font-size: var(--text-sm); font-weight: 600; }
.modal-actions { display: flex; align-items: center; justify-content: flex-end; gap: .625rem; margin-top: .25rem; }

.provider-picker { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .625rem; max-height: 32rem; overflow: auto; }
.provider-picker button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: .75rem;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-md);
  background: var(--color-paper-2);
  padding: .85rem;
  color: var(--color-muted);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.provider-picker button:hover { border-color: var(--color-rule-strong); background: var(--color-paper); }
.provider-picker button.active { border-color: color-mix(in srgb, var(--color-success) 40%, var(--color-rule)); }
.provider-picker b { display: block; color: var(--color-ink); font-size: var(--text-sm); font-weight: 600; }
.provider-picker small { display: block; margin-top: .1rem; overflow: hidden; color: var(--color-muted); font-size: var(--text-xs); text-overflow: ellipsis; white-space: nowrap; }
.provider-picker em { display: flex; align-items: center; gap: .25rem; color: var(--color-warning); font-size: var(--text-xs); font-style: normal; }
.provider-picker em.ok { color: var(--color-success); }

.bind-content p { margin: 0; color: var(--color-ink-2); font-size: var(--text-sm); }
.bind-content small { display: flex; align-items: center; gap: .4rem; color: var(--color-muted); font-size: var(--text-xs); }

@media (max-width: 640px) {
  .settings-page { padding: 1.25rem 1rem 2rem; }
  .provider-picker { grid-template-columns: 1fr; }
  .platform-list article { grid-template-columns: auto minmax(0, 1fr) auto; }
  .platform-list article > :last-child { grid-column: 2 / -1; justify-self: start; }
}
</style>
