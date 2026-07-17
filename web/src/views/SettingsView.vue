<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import type { DropdownOption } from 'naive-ui';
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
import SettingsSectionNav from '../components/settings/SettingsSectionNav.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import UiButton from '../components/ui/UiButton.vue';
import UiDialog from '../components/ui/UiDialog.vue';
import UiSelect from '../components/ui/UiSelect.vue';
import UiSwitch from '../components/ui/UiSwitch.vue';
import { api } from '../api';
import type { AIProviderInfo, GitPlatformInfo } from '../api';

type SettingsSectionKey = 'git' | 'proxy' | 'ai';

const message = useMessage();
const loading = shallowRef(false);
const providers = ref<AIProviderInfo[]>([]);
const activeProvider = shallowRef<AIProviderInfo | null>(null);
const activeModel = shallowRef('');
const selectedProviderId = shallowRef<string | null>(null);
const providerPickerVisible = shallowRef(false);
const customModalVisible = shallowRef(false);
const activeSection = shallowRef<SettingsSectionKey>('git');

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
const gitSectionStatus = computed(() => {
  const configured = gitPlatforms.value.filter(platform => platform.configured).length;
  return `${configured}/${gitPlatforms.value.length || 2} 个平台已绑定`;
});
const proxySectionStatus = computed(() => proxyEnabled.value ? '自定义代理已启用' : '跟随系统设置');
const aiSectionStatus = computed(() => activeProvider.value?.name ?? '尚未启用厂商');
const providerModalVisible = computed({ get: () => selectedProvider.value !== null, set: value => { if (!value) selectedProviderId.value = null; } });
const bindOptions = computed<DropdownOption[]>(() => [
  { label: '绑定 GitHub', key: 'github' },
  { label: '绑定 Gitee', key: 'gitee' },
]);

function getPlatformOptions(platform: string): DropdownOption[] {
  const item = gitPlatforms.value.find(value => value.id === platform);
  if (!item) return [];
  const options: DropdownOption[] = [{ label: '重新绑定', key: 'rebind' }, { label: '解除绑定', key: 'unbind' }];
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
  <div class="app-page settings-page">
    <PageHeader eyebrow="偏好设置" title="设置" summary="管理 Git 凭证、网络代理和 AI Commit 厂商。"><template #actions><UiButton size="sm" :loading="loading" @click="refreshAll"><template #icon><n-icon :component="RefreshOutline" size="16" /></template>刷新</UiButton></template></PageHeader>
    <n-spin :show="loading">
      <div class="settings-layout">
        <SettingsSectionNav
          :active="activeSection"
          :git-status="gitSectionStatus"
          :proxy-status="proxySectionStatus"
          :ai-status="aiSectionStatus"
          @select="activeSection = $event"
        />
        <div class="settings-detail">
          <Transition name="settings-pane" mode="out-in">
        <section v-if="activeSection === 'git'" key="git" class="settings-section">
          <header class="settings-section__header">
            <span class="section-symbol"><n-icon :component="KeyOutline" size="18" /></span>
            <div class="section-copy"><h2>Git 平台凭证</h2><p>用于远程同步、提交和拉取代码。</p></div>
            <div class="section-action">
              <n-dropdown :options="bindOptions" @select="handleBindSelect">
                <UiButton variant="primary" size="sm"><template #icon><n-icon :component="AddOutline" /></template>绑定平台</UiButton>
              </n-dropdown>
            </div>
          </header>
          <div class="settings-section__body">
            <div class="platform-list">
              <article v-for="platform in gitPlatforms" :key="platform.id" :class="{ active: platform.enabled }">
                <BrandIcon :provider-id="platform.id" :provider-name="platform.name" :size="34" />
                <div><b>{{ platform.name }}</b><span>{{ platform.configured ? `${platform.username || '已认证'} · ${platform.baseUrl}` : '尚未绑定身份凭证' }}</span></div>
                <em :class="platform.configured ? 'ok' : ''">{{ platform.configured ? '已绑定' : '未绑定' }}</em>
                <UiButton v-if="!platform.configured" size="sm" @click="showBindModal(platform.id as 'github' | 'gitee')">绑定</UiButton>
                <n-dropdown v-else :options="getPlatformOptions(platform.id)" @select="handlePlatformAction(platform.id, $event)"><n-button quaternary circle><n-icon :component="MedicalOutline" /></n-button></n-dropdown>
              </article>
            </div>
          </div>
        </section>

        <section v-else-if="activeSection === 'proxy'" key="proxy" class="settings-section">
          <header class="settings-section__header">
            <span class="section-symbol"><n-icon :component="GlobeOutline" size="18" /></span>
            <div class="section-copy"><h2>网络代理</h2><p>应用于 GitHub 与模型 API 请求。</p></div>
            <div class="section-action section-action--switch">
              <UiSwitch v-model="proxyEnabled" aria-label="启用网络代理" @update:model-value="onProxyToggle" />
            </div>
          </header>
          <div class="settings-section__body">
            <div v-if="proxyEnabled" class="proxy-form">
              <n-input v-model:value="proxyUrl" placeholder="http://127.0.0.1:7890" />
              <UiButton variant="primary" :loading="savingProxy" @click="saveProxy">保存代理</UiButton>
              <small>支持 HTTP、HTTPS 与 SOCKS5 代理。</small>
            </div>
            <div v-else class="quiet-state">
              <span>当前连接方式</span>
              <b>跟随系统网络设置</b>
              <small>启用后可为 GitHub 与模型请求指定代理地址。</small>
            </div>
          </div>
        </section>

        <section v-else key="ai" class="settings-section">
          <header class="settings-section__header">
            <span class="section-symbol"><n-icon :component="SparklesOutline" size="18" /></span>
            <div class="section-copy"><h2>AI Commit 厂商</h2><p>厂商列表默认收起，需要时再选择和配置。</p></div>
            <div class="section-action">
              <UiButton size="sm" @click="customModalVisible = true"><template #icon><n-icon :component="AddOutline" /></template>自定义厂商</UiButton>
            </div>
          </header>
          <div class="settings-section__body">
            <div class="provider-summary">
              <div v-if="activeProvider" class="active-provider"><BrandIcon :provider-id="activeProvider.id" :provider-name="activeProvider.name" :icon-color="activeProvider.iconColor" :size="38" /><div><span>当前启用</span><b>{{ activeProvider.name }}</b><small>{{ activeModel }}</small></div><em>运行中</em></div>
              <div v-else class="provider-notice"><n-icon :component="AlertCircleOutline" size="18" />尚未启用 AI 厂商</div>
              <button class="provider-trigger" type="button" @click="providerPickerVisible = true"><span><b>选择或更换厂商</b><small>已接入 {{ providers.length }} 个模型服务</small></span><n-icon :component="ChevronForwardOutline" size="18" /></button>
            </div>
          </div>
        </section>
          </Transition>
        </div>
      </div>
    </n-spin>

    <UiDialog v-model="providerModalVisible" :title="selectedProvider ? `配置 ${selectedProvider.name}` : '配置厂商'" size="md">
      <div v-if="selectedProvider" class="provider-config"><div class="provider-identity"><BrandIcon :provider-id="selectedProvider.id" :provider-name="selectedProvider.name" :icon-color="selectedProvider.iconColor" :size="42" /><div><b>{{ selectedProvider.name }}</b><code>{{ selectedProvider.baseUrl }}</code></div><em :class="selectedProvider.hasKey ? 'ok' : ''">{{ selectedProvider.hasKey ? '已配置' : '未配置' }}</em></div><label><span>API Key</span><n-input-group><n-input v-model:value="keyInputs[selectedProvider.id]" :type="showKey[selectedProvider.id] ? 'text' : 'password'" placeholder="输入 API Key" /><n-button @click="showKey[selectedProvider.id] = !showKey[selectedProvider.id]"><n-icon :component="showKey[selectedProvider.id] ? EyeOffOutline : EyeOutline" /></n-button><n-button type="primary" :loading="savingKey[selectedProvider.id]" @click="saveKey(selectedProvider.id)">保存</n-button></n-input-group></label><label v-if="selectedProvider.hasKey"><span>模型</span><UiSelect v-model="modelSelections[selectedProvider.id]" :options="selectedProvider.models.map(model => ({ label: model, value: model }))" /></label><div class="modal-actions"><UiButton v-if="selectedProvider.hasKey && !selectedProvider.isActive" variant="ghost" @click="clearKey(selectedProvider.id)">清除 Key</UiButton><UiButton v-if="selectedProvider.custom" variant="danger" @click="deleteCustom(selectedProvider.id)">删除厂商</UiButton><UiButton v-if="selectedProvider.hasKey" variant="primary" :loading="activatingId === selectedProvider.id" @click="activateProvider(selectedProvider)">{{ selectedProvider.isActive ? '保存模型选择' : '启用此厂商' }}</UiButton></div></div>
    </UiDialog>
    <UiDialog v-model="providerPickerVisible" title="选择 AI 厂商" size="lg">
      <div class="provider-picker"><button v-for="provider in providers" :key="provider.id" type="button" :class="{ active: provider.isActive }" @click="providerPickerVisible = false; selectedProviderId = provider.id"><BrandIcon :provider-id="provider.id" :provider-name="provider.name" :icon-color="provider.iconColor" :size="34" /><span><b>{{ provider.name }}</b><small>{{ provider.hasKey ? (provider.isActive ? modelSelections[provider.id] : '凭证已配置') : '等待配置 API Key' }}</small></span><em :class="provider.hasKey ? 'ok' : ''"><n-icon :component="provider.hasKey ? CheckmarkCircle : CloseCircle" size="14" />{{ provider.hasKey ? '已配置' : '未配置' }}</em><n-icon :component="ChevronForwardOutline" size="16" /></button></div>
    </UiDialog>
    <UiDialog v-model="customModalVisible" title="添加自定义厂商" size="sm"><div class="custom-form"><n-input v-model:value="newProvider.name" placeholder="厂商名称" /><n-input v-model:value="newProvider.id" placeholder="厂商 ID，如 my-llm" /><n-input v-model:value="newProvider.baseUrl" placeholder="API Base URL" /><n-input v-model:value="newProvider.modelsStr" placeholder="模型列表，使用逗号分隔" /><n-input v-model:value="newProvider.iconColor" placeholder="品牌色，可选" /><div class="modal-actions"><UiButton @click="customModalVisible = false">取消</UiButton><UiButton variant="primary" :loading="addingCustom" @click="addProvider">添加厂商</UiButton></div></div></UiDialog>
    <UiDialog v-model="bindModalVisible" :title="`绑定 ${bindPlatform === 'github' ? 'GitHub' : 'Gitee'}`" size="sm"><div class="bind-content"><p>请输入 Personal Access Token。凭证只保存在本地配置中。</p><n-input v-model:value="bindToken" type="password" placeholder="输入 Token" /><small><n-icon :component="InformationCircleOutline" size="14" />请确保 Token 具备仓库读写权限。</small><div class="modal-actions"><UiButton @click="bindModalVisible = false">取消</UiButton><UiButton variant="primary" :loading="binding" @click="confirmBind">确认绑定</UiButton></div></div></UiDialog>
  </div>
</template>

<style scoped>
.settings-layout { display:grid;grid-template-columns:15rem minmax(0,1fr);align-items:start;gap:2rem; }
.settings-detail { min-width:0;min-height:20rem;overflow:hidden;border:1px solid var(--color-rule);border-radius:var(--radius-lg);background:var(--color-paper);padding:1.6rem; }
.settings-section { min-width:0; }
.settings-section__header { display:grid;grid-template-columns:2.65rem minmax(0,1fr) auto;align-items:center;gap:1rem; }
.settings-section__body { display:grid;grid-template-columns:2.65rem minmax(0,1fr) auto;column-gap:1rem;margin-top:1.15rem; }
.settings-section__body>* { grid-column:2/-1; }
.section-copy { min-width:0; }
.section-copy h2 { margin:0;color:var(--color-ink);font-size:1.125rem;letter-spacing:-.025em; }
.section-copy p { margin:.3rem 0 0;color:var(--color-muted);font-size:.875rem; }
.section-action { display:flex;min-width:0;align-items:center;justify-content:flex-end; }
.section-action--switch { width:2.65rem; }
.section-symbol { display:grid;width:2.65rem;height:2.65rem;place-items:center;border:1px solid var(--color-rule);border-radius:.8rem;background:var(--color-paper-2);color:var(--color-accent); }
.platform-list { overflow:hidden;border:1px solid var(--color-rule);border-radius:.85rem;background:var(--color-paper-2); }
.platform-list article { display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:1rem;padding:1rem;transition:background-color var(--dur-fast); }
.platform-list article + article { border-top:1px solid var(--color-rule); }
.platform-list article:hover { background:var(--color-paper-3); }
.platform-list article.active { background:color-mix(in srgb,var(--color-success) 6%,var(--color-paper)); }
.platform-list b,.platform-list span { display:block; }.platform-list b { color:var(--color-ink);font-size:.95rem; }.platform-list span { margin-top:.2rem;color:var(--color-muted);font-size:.8rem; }.platform-list em,.provider-picker em,.provider-identity em { color:var(--color-warning);font-size:.78rem;font-style:normal; }.platform-list em.ok,.provider-picker em.ok,.provider-identity em.ok { color:var(--color-success); }
.proxy-form { display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.7rem;align-items:start; }.proxy-form small { grid-column:1/-1;color:var(--color-muted);font-size:.75rem; }
.quiet-state { display:grid;grid-template-columns:minmax(10rem,.35fr) minmax(12rem,.5fr) minmax(0,1fr);align-items:center;gap:1rem;border:1px solid var(--color-rule);border-radius:.8rem;background:var(--color-paper-2);padding:1rem; }
.quiet-state span { color:var(--color-muted);font-size:.8rem; }.quiet-state b { color:var(--color-ink-2);font-size:.9rem; }.quiet-state small { color:var(--color-muted);font-size:.78rem;text-align:right; }
.provider-notice { display:flex;align-items:center;gap:.5rem;border:1px solid var(--color-rule);border-radius:.8rem;background:var(--color-paper-2);padding:1rem;color:var(--color-warning);font-size:.8rem; }
.provider-summary { display:grid;grid-template-columns:minmax(0,1fr) minmax(18rem,.55fr);gap:1rem; }.active-provider { display:flex;align-items:center;gap:1rem;border:1px solid color-mix(in srgb,var(--color-success) 30%,var(--color-rule));border-radius:.8rem;background:var(--color-success-soft);padding:1rem; }.active-provider>div { flex:1; }.active-provider span,.active-provider b,.active-provider small { display:block; }.active-provider span { color:var(--color-success);font-size:.75rem; }.active-provider b { color:var(--color-ink);font-size:1rem; }.active-provider small { margin-top:.15rem;color:var(--color-muted);font-family:var(--font-mono);font-size:.78rem; }.active-provider em { color:var(--color-success);font-size:.8rem;font-style:normal; }.provider-trigger { display:flex;align-items:center;justify-content:space-between;gap:1rem;border:1px solid var(--color-rule);border-radius:.8rem;background:var(--color-paper-2);padding:1rem;color:var(--color-muted);text-align:left;transition:border-color var(--dur-fast),background var(--dur-fast),transform var(--dur-fast); }.provider-trigger:hover { border-color:var(--color-rule-strong);background:var(--color-paper);transform:translateY(-1px); }.provider-trigger b,.provider-trigger small { display:block; }.provider-trigger b { color:var(--color-ink);font-size:.95rem; }.provider-trigger small { margin-top:.2rem;font-size:.8rem; }
.provider-picker { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.85rem;max-height:34rem;overflow:auto;padding:.1rem; }.provider-picker button { display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:.85rem;border:1px solid var(--color-rule);border-radius:.8rem;background:var(--color-paper-2);padding:1rem;color:var(--color-muted);text-align:left;transition:border-color var(--dur-fast),background var(--dur-fast),transform var(--dur-fast); }.provider-picker button:hover { border-color:var(--color-rule-strong);background:var(--color-paper);transform:translateY(-1px); }.provider-picker button.active { border-color:color-mix(in srgb,var(--color-success) 40%,var(--color-rule)); }.provider-picker b,.provider-picker small { display:block; }.provider-picker b { color:var(--color-ink);font-size:.95rem; }.provider-picker small { overflow:hidden;margin-top:.2rem;color:var(--color-muted);font-size:.78rem;text-overflow:ellipsis;white-space:nowrap; }.provider-picker em { display:flex;align-items:center;gap:.3rem; }
.provider-modal { width:min(38rem,calc(100vw - 4rem)); }.provider-picker-modal { width:min(54rem,calc(100vw - 4rem)); }.custom-modal,.bind-modal { width:min(34rem,calc(100vw - 4rem)); }.provider-config,.custom-form,.bind-content { display:grid;gap:1.15rem; }.provider-identity { display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:1rem;border-bottom:1px solid var(--color-rule);padding-bottom:1.15rem; }.provider-identity b,.provider-identity code { display:block; }.provider-identity b { color:var(--color-ink);font-size:1.05rem; }.provider-identity code { margin-top:.2rem;overflow-wrap:anywhere;color:var(--color-muted);font-size:.78rem; }.provider-config label { display:grid;gap:.55rem; }.provider-config label>span { color:var(--color-ink-2);font-size:.875rem;font-weight:600; }.modal-actions { display:flex;align-items:center;justify-content:flex-end;gap:.7rem;margin-top:.35rem; }.bind-content p { margin:0;color:var(--color-ink-2);font-size:.9rem; }.bind-content small { display:flex;align-items:center;gap:.45rem;color:var(--color-muted);font-size:.78rem; }
.settings-pane-enter-active,.settings-pane-leave-active { transition:opacity 140ms var(--ease-out),transform 140ms var(--ease-out); }
.settings-pane-enter-from { opacity:0;transform:translateX(.4rem); }
.settings-pane-leave-to { opacity:0;transform:translateX(-.25rem); }
@media (prefers-reduced-motion: reduce) { .settings-pane-enter-active,.settings-pane-leave-active { transition-duration:1ms; } }
</style>
