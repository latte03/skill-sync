<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { useMessage } from 'naive-ui';
import { GridOutline, RefreshOutline, SearchOutline } from '@vicons/ionicons5';
import { api } from '../api';
import type { SkillInfo } from '../api';
import { useSkillWorkspace } from '../composables/use-skill-workspace';
import SkillCard from '../components/workspace/skill-card.vue';
import SkillInspector from '../components/workspace/skill-inspector.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import UiButton from '../components/ui/UiButton.vue';
import UiSelect from '../components/ui/UiSelect.vue';

type DistributionInput = { agents: string[]; mode: 'symlink' | 'copy' };
const message = useMessage();
const workspace = useSkillWorkspace(message.error);
const runningSkill = shallowRef<string | null>(null);
const searchInput = shallowRef<HTMLInputElement | null>(null);
const installedAgents = computed(() => workspace.installedAgents.value);
const tagNames = computed(() => Object.keys(workspace.tags.value));
const allFilterValue = '__all__';
const agentFilter = computed({ get: () => workspace.agentFilter.value || allFilterValue, set: value => { workspace.agentFilter.value = value === allFilterValue ? '' : value; } });
const tagFilter = computed({ get: () => workspace.tagFilter.value || allFilterValue, set: value => { workspace.tagFilter.value = value === allFilterValue ? '' : value; } });
const agentFilterOptions = computed(() => [{ label: '全部', value: allFilterValue }, ...installedAgents.value.map(agent => ({ label: agent.displayName, value: agent.name }))]);
const tagFilterOptions = computed(() => [{ label: '全部', value: allFilterValue }, ...tagNames.value.map(tag => ({ label: tag, value: tag }))]);
const distributedCount = computed(() => workspace.skills.value.filter(skill => skill.agents.length).length);

async function distribute(skill: SkillInfo, input: DistributionInput, dryRun = false) {
  runningSkill.value = skill.name;
  try {
    await api.deploySkill(skill.name, input.agents, { mode: input.mode, dryRun });
    message.success(dryRun ? '预览完成，没有写入文件' : `已添加 ${input.agents.length} 个分发目标`);
    if (!dryRun) { await workspace.refresh(); const refreshed = workspace.skills.value.find(item => item.name === skill.name); if (refreshed) await workspace.selectSkill(refreshed); }
  } catch (error) { message.error(`分发失败: ${(error as Error).message}`); }
  finally { runningSkill.value = null; }
}
function onKeydown(event: KeyboardEvent) { if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); searchInput.value?.focus(); } }
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="skills-workspace">
    <PageHeader eyebrow="本地技能库" title="技能库" :count="workspace.visibleSkills.value.length" summary="统一管理来源、版本与 Agent 分发关系。"><template #actions><UiButton size="sm" :loading="workspace.loading.value" @click="workspace.refresh"><template #icon><n-icon :component="RefreshOutline" size="16" /></template>刷新</UiButton></template></PageHeader>
    <section class="workspace-toolbar">
      <label class="skill-search"><n-icon :component="SearchOutline" size="14" /><input ref="searchInput" v-model="workspace.query.value" placeholder="搜索 Skill、描述或 SkillKey"><kbd>/</kbd></label>
      <div class="workspace-filter workspace-filter--agent"><UiSelect v-model="agentFilter" prefix="Agent" :options="agentFilterOptions" /></div>
      <div class="workspace-filter workspace-filter--tag"><UiSelect v-model="tagFilter" prefix="Tag" :options="tagFilterOptions" /></div>
      <div class="view-control"><button class="active" type="button" title="卡片视图"><n-icon :component="GridOutline" size="13" /></button></div>
    </section>
    <section class="catalogue-meta"><span><i />工作区正常</span><span>{{ distributedCount }} 个已分发</span><span>{{ workspace.status.value?.unmanagedCount ?? 0 }} 个待关联来源</span><b>{{ installedAgents.length }} 个可用 Agent</b></section>
    <n-spin :show="workspace.loading.value">
      <section v-if="workspace.visibleSkills.value.length" class="skill-grid"><SkillCard v-for="skill in workspace.visibleSkills.value" :key="skill.name" :skill="skill" :agents="workspace.agents.value" :selected="workspace.selectedSkill.value?.name === skill.name" :busy="runningSkill === skill.name" @select="workspace.selectSkill" @preview="(item, input) => distribute(item, input, true)" @distribute="distribute" /></section>
      <section v-else class="empty-catalogue"><span>⌕</span><b>没有符合条件的 Skill</b><p>调整搜索词或清除筛选条件后再试。</p><button type="button" @click="workspace.query.value = ''; workspace.agentFilter.value = ''; workspace.tagFilter.value = ''">清除筛选</button></section>
    </n-spin>
    <SkillInspector :skill="workspace.selectedSkill.value" :detail="workspace.selectedDetail.value" :agents="workspace.agents.value" :loading="workspace.detailLoading.value" :busy="runningSkill === workspace.selectedSkill.value?.name" @close="workspace.closeInspector" @preview="(item, input) => distribute(item, input, true)" @distribute="distribute" />
  </div>
</template>

<style scoped>
.skills-workspace { width: 100%; max-width: 104rem; margin: 0 auto; padding: 1.25rem 1.5rem 3rem; }.workspace-header { display: flex; align-items: end; justify-content: space-between; gap: 1rem; }.workspace-header p { margin: 0; color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; font-weight: 650; letter-spacing: .1em; }.workspace-header h1 { margin: .28rem 0 0; color: var(--color-ink); font-size: 1.45rem; font-weight: 660; letter-spacing: -.05em; line-height: 1; }.workspace-header h1 span { margin-left: .35rem; color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; font-weight: 500; letter-spacing: 0; }.workspace-header small { display: block; margin-top: .4rem; color: var(--color-muted); font-size: .75rem; }.refresh-button { display: flex; height: 1.95rem; align-items: center; gap: .35rem; border: 1px solid var(--color-rule); border-radius: .5rem; background: var(--color-paper); padding: 0 .62rem; color: var(--color-ink-2); font-size: .75rem; box-shadow: var(--shadow-xs); }.refresh-button:hover { border-color: var(--color-rule-strong); }.refresh-button:disabled { opacity: .45; }
.workspace-toolbar { display: flex; align-items: center; gap: .45rem; margin-top: 1.1rem; }.skill-search { display: flex; width: min(30rem, 48vw); height: 2.05rem; align-items: center; gap: .45rem; border: 1px solid var(--color-rule); border-radius: .55rem; background: var(--color-paper); padding: 0 .58rem; color: var(--color-muted); box-shadow: var(--shadow-xs); }.skill-search:focus-within { border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-rule)); box-shadow: 0 0 0 3px var(--color-focus-ring); }.skill-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--color-ink); font-size: .75rem; }.skill-search kbd { border: 1px solid var(--color-rule); border-radius: .28rem; background: var(--color-paper-2); padding: .03rem .25rem; color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; }.filter-select { position: relative; display: flex; height: 2.05rem; align-items: center; gap: .3rem; border: 1px solid var(--color-rule); border-radius: .55rem; background: var(--color-paper); padding: 0 .5rem; color: var(--color-faint); box-shadow: var(--shadow-xs); }.filter-select span { font-family: var(--font-mono); font-size: .75rem; text-transform: uppercase; }.filter-select select { max-width: 8rem; appearance: none; border: 0; outline: 0; background: transparent; padding-right: .1rem; color: var(--color-ink-2); font-size: .75rem; }.view-control { display: flex; margin-left: auto; border: 1px solid var(--color-rule); border-radius: .5rem; background: var(--color-paper); padding: .15rem; }.view-control button { display: grid; width: 1.55rem; height: 1.55rem; place-items: center; border: 0; border-radius: .36rem; background: transparent; color: var(--color-faint); }.view-control .active { background: var(--color-paper-3); color: var(--color-ink); }
.workspace-filter { flex:none; }.workspace-filter--agent { width:11rem; }.workspace-filter--tag { width:9rem; }.workspace-filter :deep(.ui-select-trigger) { min-height:2.4rem;border-radius:.55rem; }
.catalogue-meta { display: flex; align-items: center; gap: .9rem; margin: .85rem 0 .65rem; color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; }.catalogue-meta span { display: flex; align-items: center; gap: .32rem; }.catalogue-meta i { width: .34rem; height: .34rem; border-radius: 999px; background: var(--color-success); box-shadow: 0 0 0 3px var(--color-success-soft); }.catalogue-meta b { margin-left: auto; font-weight: 500; }.skill-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15.5rem), 1fr)); gap: .65rem; }.empty-catalogue { display: grid; min-height: 20rem; place-content: center; justify-items: center; border: 1px dashed var(--color-rule-strong); border-radius: var(--radius-lg); color: var(--color-muted); text-align: center; }.empty-catalogue > span { display: grid; width: 2.3rem; height: 2.3rem; place-items: center; border-radius: .7rem; background: var(--color-paper); font-size: 1rem; box-shadow: var(--shadow-xs); }.empty-catalogue b { margin-top: .7rem; color: var(--color-ink); font-size: .75rem; }.empty-catalogue p { margin: .18rem 0 .7rem; font-size: .75rem; }.empty-catalogue button { border: 1px solid var(--color-rule); border-radius: .45rem; background: var(--color-paper); padding: .38rem .6rem; color: var(--color-ink-2); font-size: .75rem; }
@media (max-width: 760px) { .skills-workspace { padding: 1rem .9rem 2.5rem; }.workspace-toolbar { flex-wrap: wrap; }.skill-search { width: 100%; }.view-control { margin-left: 0; }.catalogue-meta b { display: none; }.skill-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr)); } }

/* Desktop workspace scale (1280px+). */
.skills-workspace { max-width: var(--content-max-width); padding: 2rem 2.25rem 4rem; }
.workspace-toolbar { gap: .7rem; margin-top: 1.5rem; }
.skill-search,.filter-select { height: 2.4rem; }
.skill-search { width: min(34rem, 48vw); }
.skill-search input,.filter-select select { font-size: .78rem; }
.catalogue-meta { gap: 1.25rem; margin: 1.1rem 0 .9rem; }
.skill-grid { grid-template-columns: repeat(auto-fill,minmax(17rem,1fr)); gap: 1rem; }
</style>
