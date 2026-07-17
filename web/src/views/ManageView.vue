<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { EyeOutline, FlashOutline, RefreshOutline } from '@vicons/ionicons5';
import { api } from '../api';
import type { AgentInfo, SkillInfo } from '../api';

const message = useMessage();
const skills = ref<SkillInfo[]>([]);
const agents = ref<AgentInfo[]>([]);
const loading = ref(false);
const actionOpen = shallowRef(false);
const selectedSkill = ref<SkillInfo | null>(null);
const selectedAgents = ref<string[]>([]);
const mode = shallowRef<'symlink' | 'copy'>('symlink');
const running = ref(false);
const action = shallowRef<'deploy' | 'undeploy'>('deploy');
const query = shallowRef('');

const installedAgents = computed(() => agents.value.filter(agent => agent.installed));
const agentOptions = computed(() => installedAgents.value.map(agent => ({ label: agent.displayName, value: agent.name })));
const visibleSkills = computed(() => skills.value.filter(skill => !query.value.trim() || skill.name.toLowerCase().includes(query.value.trim().toLowerCase())));
const coverage = computed(() => {
  const total = skills.value.length * installedAgents.value.length;
  const active = skills.value.reduce((count, skill) => count + skill.agents.filter(agent => installedAgents.value.some(item => item.name === agent)).length, 0);
  return { active, total };
});

async function refresh() {
  loading.value = true;
  try {
    const [skillsResponse, agentsResponse] = await Promise.all([api.getSkills(), api.getAgents()]);
    skills.value = skillsResponse.skills;
    agents.value = agentsResponse.agents;
  } catch (error) {
    message.error(`加载分发状态失败: ${(error as Error).message}`);
  } finally {
    loading.value = false;
  }
}

function openAction(skill: SkillInfo, nextAction: 'deploy' | 'undeploy') {
  selectedSkill.value = skill;
  action.value = nextAction;
  selectedAgents.value = nextAction === 'undeploy' ? [...skill.agents] : [];
  actionOpen.value = true;
}

async function execute(dryRun = false) {
  if (!selectedSkill.value || selectedAgents.value.length === 0) return;
  running.value = true;
  try {
    if (action.value === 'deploy') await api.deploySkill(selectedSkill.value.name, selectedAgents.value, { mode: mode.value, dryRun });
    else await api.undeploySkill(selectedSkill.value.name, selectedAgents.value, { dryRun });
    message.success(dryRun ? '预览完成：未写入任何文件' : action.value === 'deploy' ? '分发已完成' : '取消分发已完成');
    if (!dryRun) {
      actionOpen.value = false;
      await refresh();
    }
  } catch (error) {
    message.error(`操作失败: ${(error as Error).message}`);
  } finally {
    running.value = false;
  }
}

refresh();
</script>

<template>
  <div class="app-page distribution-page">
    <header class="grid gap-6 lg:grid-cols-[minmax(0_1fr)_auto] lg:items-end">
      <div class="page-heading"><p class="page-kicker">RELATION VIEW</p><h1 class="page-title">分发关系</h1><p class="page-summary">这是用于批量核查覆盖关系的辅助视图；日常分发请从技能库卡片右下角的 Agent 堆叠开始。</p></div>
      <div class="page-toolbar lg:justify-end"><n-button size="small" :loading="loading" @click="refresh"><template #icon><n-icon :component="RefreshOutline" /></template>刷新矩阵</n-button></div>
    </header>

    <section class="grid gap-px overflow-clip rounded-[var(--radius-lg)] bg-[var(--color-rule)] shadow-[var(--shadow-sm)] sm:grid-cols-2 xl:grid-cols-4">
      <div class="min-h-34 bg-[var(--color-graphite)] p-6 text-[var(--color-graphite-ink)]"><p class="m-0 text-[0.6875rem] font-[var(--font-mono)] tracking-[0.1em] uppercase text-[var(--color-graphite-ink)]/55">ACTIVE LINKS</p><strong class="mt-2 block font-[var(--font-display)] text-4xl leading-none tracking-[-0.07em]">{{ coverage.active }}</strong><span class="mt-2 block text-xs text-[var(--color-graphite-ink)]/68">有效分发</span></div>
      <div class="min-h-34 bg-[var(--color-paper)] p-6"><p class="metric-label">POSSIBLE LINKS</p><strong class="mt-2 block font-[var(--font-display)] text-4xl leading-none tracking-[-0.07em] text-[var(--color-ink)]">{{ coverage.total }}</strong><span class="mt-2 block text-xs text-[var(--color-muted)]">可分发组合</span></div>
      <div class="min-h-34 bg-[var(--color-paper)] p-6"><p class="metric-label">INSTALLED AGENTS</p><strong class="mt-2 block font-[var(--font-display)] text-4xl leading-none tracking-[-0.07em] text-[var(--color-ink)]">{{ installedAgents.length }}</strong><span class="mt-2 block text-xs text-[var(--color-muted)]">已检测目标</span></div>
      <div class="flex min-h-34 items-center bg-[var(--color-paper)] p-4"><n-input v-model:value="query" clearable placeholder="筛选 Skill" /></div>
    </section>

    <n-spin :show="loading">
      <section class="matrix surface" :style="{ '--agent-count': installedAgents.length }">
        <div class="matrix-head"><span>Skill</span><span v-for="agent in installedAgents" :key="agent.name">{{ agent.displayName }}</span><span>操作</span></div>
        <article v-for="skill in visibleSkills" :key="skill.name" class="matrix-row hover:bg-[var(--color-paper-2)]">
          <div class="skill-cell"><strong>{{ skill.name }}</strong><small>v{{ skill.version }} · {{ skill.managed ? '已纳管' : '待确认' }}</small></div>
          <div v-for="agent in installedAgents" :key="agent.name" class="coverage-cell"><span :class="skill.agents.includes(agent.name) ? 'coverage-dot coverage-dot--active' : 'coverage-dot'" :title="skill.agents.includes(agent.name) ? '已分发' : '未分发'">{{ skill.agents.includes(agent.name) ? '已覆盖' : '未覆盖' }}</span></div>
          <div class="row-actions"><n-button size="tiny" quaternary @click="openAction(skill, 'deploy')">分发</n-button><n-button size="tiny" quaternary :disabled="skill.agents.length === 0" @click="openAction(skill, 'undeploy')">移除</n-button></div>
        </article>
        <n-empty v-if="visibleSkills.length === 0" class="p-8" description="没有匹配的 Skill" />
      </section>
    </n-spin>

    <n-modal v-model:show="actionOpen" preset="card" :title="action === 'deploy' ? '分发 Skill' : '取消分发'" class="max-w-[32rem]">
      <div class="grid gap-4"><p class="m-0 break-words font-[var(--font-mono)] text-sm text-[var(--color-ink)]">{{ selectedSkill?.name }}</p><n-select v-model:value="selectedAgents" :options="action === 'deploy' ? agentOptions : agentOptions.filter(option => selectedSkill?.agents.includes(option.value))" multiple placeholder="选择 Agent" /><n-radio-group v-if="action === 'deploy'" v-model:value="mode"><n-radio value="symlink">符号链接</n-radio><n-radio value="copy">复制副本</n-radio></n-radio-group><p class="m-0 text-xs leading-5 text-[var(--color-muted)]">{{ action === 'deploy' ? '预览只计算恢复后将执行的动作，不会写入文件。' : '取消分发会删除目标 Agent 中由 SkillSync 管理的副本。' }}</p><div class="inline-actions"><n-button :disabled="selectedAgents.length === 0" :loading="running" @click="execute(true)"><template #icon><n-icon :component="EyeOutline" /></template>预览</n-button><n-button :type="action === 'deploy' ? 'primary' : 'warning'" :disabled="selectedAgents.length === 0" :loading="running" @click="execute(false)"><template #icon><n-icon :component="FlashOutline" /></template>{{ action === 'deploy' ? '确认分发' : '确认移除' }}</n-button></div></div>
    </n-modal>
  </div>
</template>

<style scoped>
.matrix { overflow: auto; }
.matrix-head, .matrix-row { display: grid; grid-template-columns: minmax(15rem, 1.5fr) repeat(var(--agent-count, 1), minmax(7rem, 1fr)) minmax(8rem, auto); min-inline-size: max-content; }
.matrix-head { position: sticky; inset-block-start: 0; z-index: 1; border-block-end: var(--rule); background: var(--color-paper); color: var(--color-muted); font-family: var(--font-mono); font-size: 0.625rem; letter-spacing: 0.08em; text-transform: uppercase; }
.matrix-head span, .matrix-row > * { padding: var(--space-md); border-inline-end: var(--rule); }.matrix-row { border-block-end: var(--rule); transition: background var(--dur-fast) var(--ease-out); }.matrix-row:last-of-type { border-block-end: 0; }
.skill-cell { display: grid; gap: var(--space-2xs); }.skill-cell strong { color: var(--color-ink); font-size: var(--text-sm); }.skill-cell small { color: var(--color-muted); font-family: var(--font-mono); font-size: 0.625rem; }
.coverage-cell { display: grid; place-items: center; }.coverage-dot { display: inline-flex; align-items: center; gap: var(--space-2xs); color: var(--color-muted); font-family: var(--font-mono); font-size: 0.625rem; white-space: nowrap; }.coverage-dot::before { content: ''; inline-size: 0.5rem; block-size: 0.5rem; border-radius: 50%; background: var(--color-rule-strong); }.coverage-dot--active { color: var(--color-success); }.coverage-dot--active::before { background: var(--color-success); box-shadow: 0 0 0 4px color-mix(in oklch, var(--color-success) 15%, transparent); }.row-actions { display: flex; align-items: center; gap: var(--space-xs); }
@media (max-width: 39.99rem) { .matrix-head { display: none; }.matrix-row { grid-template-columns: 1fr; min-inline-size: 0; }.matrix-row > * { border-inline-end: 0; border-block-end: var(--rule); }.coverage-cell { display: flex; justify-content: space-between; }.coverage-cell::before { content: 'Agent 覆盖'; color: var(--color-muted); font-family: var(--font-mono); font-size: 0.625rem; }.row-actions { border-block-end: 0; } }
</style>
