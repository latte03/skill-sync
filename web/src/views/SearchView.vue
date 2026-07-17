<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { CloudDownloadOutline, SearchOutline } from '@vicons/ionicons5';
import { api } from '../api';
import type { AgentInfo, SearchResult } from '../api';

const message = useMessage();
const query = shallowRef('');
const scope = shallowRef<'all' | 'local' | 'remote'>('all');
const loading = ref(false);
const localResults = ref<SearchResult[]>([]);
const remoteResults = ref<SearchResult[]>([]);
const searched = shallowRef(false);
const installOpen = shallowRef(false);
const installing = ref(false);
const selected = ref<SearchResult | null>(null);
const agents = ref<AgentInfo[]>([]);
const deployTargets = ref<string[]>([]);
const mode = shallowRef<'symlink' | 'copy'>('symlink');
const deployAfterInstall = shallowRef(true);
const installDependencies = shallowRef(false);

const agentOptions = computed(() => agents.value.filter(agent => agent.installed).map(agent => ({ label: agent.displayName, value: agent.name })));

async function search() {
  const value = query.value.trim();
  if (!value) return;
  loading.value = true; searched.value = true;
  try { const result = await api.search(value, scope.value); localResults.value = result.local; remoteResults.value = result.remote; }
  catch (error) { message.error(`搜索失败: ${(error as Error).message}`); }
  finally { loading.value = false; }
}

async function openInstall(result: SearchResult) {
  selected.value = result; deployTargets.value = []; deployAfterInstall.value = true; installDependencies.value = false; installOpen.value = true;
  try { agents.value = (await api.getAgents()).agents; } catch { /* Installation can still run without deployment targets. */ }
}

async function install() {
  if (!selected.value) return;
  installing.value = true;
  try {
    await api.installSkill({ source: `${selected.value.source}/${selected.value.skillId}`, agents: deployAfterInstall.value ? deployTargets.value : [], mode: mode.value, noDeploy: !deployAfterInstall.value, installDeps: installDependencies.value });
    message.success('Skill 已安装到中央仓库'); installOpen.value = false;
  } catch (error) { message.error(`安装失败: ${(error as Error).message}`); }
  finally { installing.value = false; }
}
</script>

<template>
  <div class="app-page search-page"><header class="page-heading"><p class="page-kicker">DISCOVER SKILLS</p><h1 class="page-title">发现与安装</h1><p class="page-summary">从本地索引和 skills.sh 发现 Skill。安装与包依赖执行均需要明确确认。</p></header>
    <section class="search-stage"><div class="search-field"><n-icon :component="SearchOutline" size="20" /><n-input v-model:value="query" placeholder="输入技能名、用途或关键词" clearable @keyup.enter="search" /><n-button type="primary" :loading="loading" @click="search">搜索</n-button></div><n-radio-group v-model:value="scope" name="search-scope"><n-radio value="all">全部</n-radio><n-radio value="local">仅本地</n-radio><n-radio value="remote">仅 skills.sh</n-radio></n-radio-group></section>
    <n-spin :show="loading"><template v-if="searched"><section v-if="localResults.length" class="result-section"><div class="section-title"><p class="meta-label">LOCAL RESULTS</p><span>{{ localResults.length }} 项</span></div><article v-for="result in localResults" :key="`local:${result.skillId}`" class="result-row"><div><h2>{{ result.name }}</h2><p>{{ result.description || '未提供描述' }}</p></div><div class="result-meta"><code>{{ result.localVersion ? `v${result.localVersion}` : 'local' }}</code></div></article></section><section v-if="remoteResults.length" class="result-section"><div class="section-title"><p class="meta-label">REMOTE RESULTS</p><span>{{ remoteResults.length }} 项</span></div><article v-for="result in remoteResults" :key="`${result.source}:${result.skillId}`" class="result-row"><div><h2>{{ result.name }}</h2><code>{{ result.source }}/{{ result.skillId }}</code><p>{{ result.description || '未提供描述' }}</p></div><div class="result-actions"><span v-if="result.stars !== undefined">★ {{ result.stars }}</span><n-button size="small" type="primary" @click="openInstall(result)"><template #icon><n-icon :component="CloudDownloadOutline" /></template>安装</n-button></div></article></section><n-empty v-if="localResults.length === 0 && remoteResults.length === 0" description="没有找到匹配的 Skill" /></template><n-empty v-else description="输入关键词，开始查找可用 Skill" /></n-spin>
    <n-modal v-model:show="installOpen" preset="card" title="安装 Skill" class="install-modal"><div v-if="selected" class="install-form"><p class="install-name">{{ selected.name }}</p><code>{{ selected.source }}/{{ selected.skillId }}</code><n-switch v-model:value="deployAfterInstall">安装后立即分发</n-switch><n-select v-if="deployAfterInstall" v-model:value="deployTargets" :options="agentOptions" multiple placeholder="选择分发目标（可稍后处理）" /><n-radio-group v-if="deployAfterInstall" v-model:value="mode"><n-radio value="symlink">符号链接</n-radio><n-radio value="copy">复制副本</n-radio></n-radio-group><n-checkbox v-model:checked="installDependencies">明确安装 Skill 声明的包依赖</n-checkbox><p class="install-note">默认不会安装 npm/pip 包依赖；勾选后仍只会执行 SKILL.md 中已持久化的声明。</p><n-button type="primary" :loading="installing" @click="install">确认安装</n-button></div></n-modal>
  </div>
</template>

<style scoped>
.search-stage { display: grid; gap: var(--space-md); padding: var(--space-lg); border: var(--rule); border-radius: var(--radius-lg); background: var(--color-graphite); color: var(--color-graphite-ink); }.search-field { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-xs) var(--space-sm); border: 1px solid var(--color-rule-strong); border-radius: var(--radius-sm); background: var(--color-graphite-2); }.search-field :deep(.n-input) { flex: 1; }.result-section { display: grid; gap: var(--space-xs); }.section-title { display: flex; align-items: center; justify-content: space-between; }.section-title span { color: var(--color-muted); font-family: var(--font-mono); font-size: var(--text-xs); }.result-row { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-md); padding: var(--space-lg); border: var(--rule); border-radius: var(--radius-lg); background: var(--color-paper); }.result-row h2 { margin: 0; color: var(--color-ink); font-size: var(--text-base); }.result-row p { margin: var(--space-xs) 0 0; color: var(--color-muted); font-size: var(--text-sm); }.result-row code, .install-form code { color: var(--color-accent); font-family: var(--font-mono); font-size: 0.625rem; overflow-wrap: anywhere; }.result-actions, .result-meta { display: flex; flex: 0 0 auto; align-items: center; gap: var(--space-sm); color: var(--color-muted); font-family: var(--font-mono); font-size: var(--text-xs); }.install-modal { max-inline-size: 34rem; }.install-form { display: grid; gap: var(--space-md); }.install-name, .install-note { margin: 0; }.install-name { color: var(--color-ink); font-size: var(--text-lg); font-weight: 600; }.install-note { color: var(--color-muted); font-size: var(--text-xs); } @media (max-width: 39.99rem) { .search-field, .result-row { flex-direction: column; align-items: stretch; }.result-actions { justify-content: space-between; } }
</style>
