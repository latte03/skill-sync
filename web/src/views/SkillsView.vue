<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { FlashOutline, RefreshOutline, SearchOutline } from '@vicons/ionicons5';
import { api } from '../api';
import type { AgentInfo, SkillInfo, StatusInfo } from '../api';

const router = useRouter();
const message = useMessage();
const loading = ref(false);
const skills = ref<SkillInfo[]>([]);
const status = ref<StatusInfo | null>(null);
const agents = ref<AgentInfo[]>([]);
const tags = ref<Record<string, string[]>>({});
const query = shallowRef('');
const agentFilter = shallowRef<string | null>(null);
const tagFilter = shallowRef<string | null>(null);

const agentOptions = computed(() => agents.value.filter(agent => agent.installed).map(agent => ({ label: agent.displayName, value: agent.name })));
const tagOptions = computed(() => Object.keys(tags.value).map(tag => ({ label: tag, value: tag })));
const visibleSkills = computed(() => skills.value.filter((skill) => {
  const value = query.value.trim().toLowerCase();
  return (!value || skill.name.toLowerCase().includes(value) || skill.description.toLowerCase().includes(value))
    && (!agentFilter.value || skill.agents.includes(agentFilter.value))
    && (!tagFilter.value || skill.tags.includes(tagFilter.value));
}));
const metrics = computed(() => [
  { label: '中央仓库', value: status.value?.skillCount ?? 0, note: '可追踪 Skill' },
  { label: '已分发', value: skills.value.filter(skill => skill.agents.length > 0).length, note: '至少覆盖一个 Agent' },
  { label: '未纳管', value: status.value?.unmanagedCount ?? 0, note: '需要确认来源' },
  { label: '已安装 Agent', value: status.value?.installedAgents.length ?? 0, note: '可作为分发目标' },
]);

async function refresh() {
  loading.value = true;
  try {
    const [statusResponse, skillsResponse, agentResponse, tagResponse] = await Promise.all([api.getStatus(), api.getSkills(), api.getAgents(), api.getTags()]);
    status.value = statusResponse;
    skills.value = skillsResponse.skills;
    agents.value = agentResponse.agents;
    tags.value = tagResponse.tags;
  } catch (error) {
    message.error(`加载技能库失败: ${(error as Error).message}`);
  } finally {
    loading.value = false;
  }
}

refresh();
</script>

<template>
  <div class="app-page skills-page">
    <header class="grid gap-6 lg:grid-cols-[minmax(0_1fr)_auto] lg:items-end">
      <div class="page-heading">
        <p class="page-kicker">SKILL INVENTORY</p>
        <h1 class="page-title">技能库</h1>
        <p class="page-summary">从来源到 Agent 覆盖，所有 Skill 都以可操作的状态呈现。</p>
      </div>
      <div class="page-toolbar lg:justify-end">
        <n-button size="small" :loading="loading" @click="refresh"><template #icon><n-icon :component="RefreshOutline" /></template>刷新</n-button>
        <n-button type="primary" size="small" @click="router.push({ name: 'manage' })"><template #icon><n-icon :component="FlashOutline" /></template>打开分发控制台</n-button>
      </div>
    </header>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="(metric, index) in metrics" :key="metric.label" :class="['grid min-h-36 gap-2 rounded-[var(--radius-lg)] p-6', index === 0 ? 'bg-[var(--color-graphite)] text-[var(--color-graphite-ink)] shadow-[var(--shadow-md)]' : 'surface']">
        <p :class="index === 0 ? 'm-0 text-[0.6875rem] font-[var(--font-mono)] tracking-[0.1em] uppercase text-[var(--color-graphite-ink)]/58' : 'metric-label'">{{ metric.label }}</p>
        <strong :class="index === 0 ? 'font-[var(--font-display)] text-4xl leading-none tracking-[-0.07em]' : 'font-[var(--font-display)] text-4xl leading-none tracking-[-0.07em] text-[var(--color-ink)]'">{{ metric.value }}</strong>
        <span :class="index === 0 ? 'text-xs text-[var(--color-graphite-ink)]/68' : 'text-xs text-[var(--color-muted)]'">{{ metric.note }}</span>
      </article>
    </section>

    <section class="surface grid gap-3 p-3 lg:grid-cols-[minmax(16rem_1fr)_10rem_10rem_auto] lg:items-center">
      <div class="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-paper-2)] px-3 text-[var(--color-muted)]"><n-icon :component="SearchOutline" size="18" /><n-input v-model:value="query" class="flex-1" placeholder="按名称或描述筛选" clearable /></div>
      <n-select v-model:value="agentFilter" :options="agentOptions" clearable placeholder="Agent 覆盖" />
      <n-select v-model:value="tagFilter" :options="tagOptions" clearable placeholder="标签" />
      <span class="justify-self-end text-xs font-[var(--font-mono)] text-[var(--color-muted)]">{{ visibleSkills.length }} 项结果</span>
    </section>

    <n-spin :show="loading">
      <section v-if="visibleSkills.length" class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
        <article v-for="skill in visibleSkills" :key="skill.name" class="group grid min-h-62 cursor-pointer gap-6 rounded-[var(--radius-lg)] border border-[var(--color-rule)] bg-[var(--color-paper)] p-6 shadow-[var(--shadow-sm)] transition-[transform,border-color,box-shadow] duration-180 ease-out hover:-translate-y-1 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-md)]" tabindex="0" role="link" @click="router.push({ name: 'skillDetail', params: { name: skill.name } })" @keydown.enter="router.push({ name: 'skillDetail', params: { name: skill.name } })">
          <header class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-start gap-3">
              <span class="grid h-10 w-10 flex-none place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] font-[var(--font-mono)] text-sm font-600 text-[var(--color-accent)]">{{ skill.name.split('/').at(-1)?.slice(0, 2).toUpperCase() }}</span>
              <div class="min-w-0"><h2 class="m-0 break-words text-sm font-600 text-[var(--color-ink)]">{{ skill.name }}</h2><p class="mt-1 mb-0 text-[0.625rem] font-[var(--font-mono)] text-[var(--color-muted)]">v{{ skill.version }}</p></div>
            </div>
            <n-tag :type="skill.managed ? 'success' : 'warning'" size="small">{{ skill.managed ? '已纳管' : '待确认' }}</n-tag>
          </header>
          <p class="m-0 text-sm leading-6 text-[var(--color-muted)]">{{ skill.description || '未提供描述' }}</p>
          <footer class="mt-auto flex items-end justify-between gap-3">
            <div class="flex flex-wrap gap-1"><span v-for="tag in skill.tags.slice(0, 2)" :key="tag" class="rounded-md bg-[var(--color-paper-2)] px-2 py-1 text-[0.625rem] font-[var(--font-mono)] text-[var(--color-muted)]">{{ tag }}</span><span v-if="skill.tags.length > 2" class="rounded-md bg-[var(--color-paper-2)] px-2 py-1 text-[0.625rem] font-[var(--font-mono)] text-[var(--color-muted)]">+{{ skill.tags.length - 2 }}</span><span v-if="skill.tags.length === 0" class="px-2 py-1 text-[0.625rem] font-[var(--font-mono)] text-[var(--color-muted)]">无标签</span></div>
            <p class="m-0 whitespace-nowrap text-xs text-[var(--color-muted)]"><b class="font-[var(--font-mono)] text-[var(--color-ink)]">{{ skill.agents.length }}</b> 个 Agent</p>
          </footer>
        </article>
      </section>
      <n-empty v-else description="没有符合条件的 Skill" />
    </n-spin>
  </div>
</template>
