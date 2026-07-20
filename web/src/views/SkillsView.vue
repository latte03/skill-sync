<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { RefreshOutline, SearchOutline } from '@vicons/ionicons5';
import { useToast } from '../composables/useToast';
import { api } from '../api';
import type { SkillInfo } from '../api';
import { useSkillWorkspace } from '../composables/use-skill-workspace';
import SkillCard from '../components/workspace/skill-card.vue';
import SkillInspector from '../components/workspace/skill-inspector.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import UiButton from '../components/ui/UiButton.vue';
import UiSelect from '../components/ui/UiSelect.vue';
import UiSpin from '../components/ui/UiSpin.vue';
import UiIcon from '../components/ui/UiIcon.vue';

type DistributionInput = { add: string[]; remove: string[]; mode: 'symlink' | 'copy' };
const message = useToast();
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

async function distribute(skill: SkillInfo, input: DistributionInput) {
  runningSkill.value = skill.name;
  try {
    if (input.add.length) await api.deploySkill(skill.name, input.add, { mode: input.mode });
    if (input.remove.length) await api.undeploySkill(skill.name, input.remove);
    const parts: string[] = [];
    if (input.add.length) parts.push(`新增 ${input.add.length}`);
    if (input.remove.length) parts.push(`移除 ${input.remove.length}`);
    message.success(`分发已更新（${parts.join('，')}）`);
    await workspace.refresh();
    const refreshed = workspace.skills.value.find(item => item.name === skill.name);
    if (refreshed) await workspace.selectSkill(refreshed);
  } catch (error) { message.error(`分发失败: ${(error as Error).message}`); }
  finally { runningSkill.value = null; }
}
function onKeydown(event: KeyboardEvent) { if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); searchInput.value?.focus(); } }
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="skills-workspace">
    <PageHeader title="技能库" :count="workspace.visibleSkills.value.length" summary="管理来源、版本与 Agent 分发关系"><template #actions><UiButton size="sm" :loading="workspace.loading.value" @click="workspace.refresh"><template #icon><UiIcon :component="RefreshOutline" size="15" /></template>刷新</UiButton></template></PageHeader>
    <section class="workspace-toolbar">
      <label class="skill-search"><UiIcon :component="SearchOutline" size="14" /><input ref="searchInput" v-model="workspace.query.value" placeholder="搜索 Skill…"><kbd>/</kbd></label>
      <div class="workspace-filter"><UiSelect v-model="agentFilter" prefix="Agent" :options="agentFilterOptions" /></div>
      <div class="workspace-filter"><UiSelect v-model="tagFilter" prefix="Tag" :options="tagFilterOptions" /></div>
    </section>
    <UiSpin :show="workspace.loading.value">
      <section v-if="workspace.visibleSkills.value.length" class="skill-grid"><SkillCard v-for="skill in workspace.visibleSkills.value" :key="skill.name" :skill="skill" :agents="workspace.agents.value" :selected="workspace.selectedSkill.value?.name === skill.name" :busy="runningSkill === skill.name" @select="workspace.selectSkill" @distribute="distribute" /></section>
      <section v-else class="empty-catalogue"><div class="empty-icon"><UiIcon :component="SearchOutline" size="20" /></div><b>没有符合条件的 Skill</b><p>调整搜索词或清除筛选条件</p><button type="button" @click="workspace.query.value = ''; workspace.agentFilter.value = ''; workspace.tagFilter.value = ''">清除筛选</button></section>
    </UiSpin>
    <SkillInspector :skill="workspace.selectedSkill.value" :detail="workspace.selectedDetail.value" :agents="workspace.agents.value" :loading="workspace.detailLoading.value" :busy="runningSkill === workspace.selectedSkill.value?.name" @close="workspace.closeInspector" @distribute="distribute" />
  </div>
</template>

<style scoped>
.skills-workspace { width:100%;max-width:var(--content-max-width);margin:0 auto;padding:1.75rem 2rem 3rem; }

.workspace-toolbar { display:flex;align-items:center;gap:.5rem;margin-top:1.25rem; }
.skill-search { display:flex;width:min(24rem,40vw);height:2.125rem;align-items:center;gap:.5rem;border:1px solid var(--color-rule-strong);border-radius:var(--radius-sm);background:var(--color-paper);padding:0 .625rem;color:var(--color-faint);transition:border-color var(--dur-fast),box-shadow var(--dur-fast); }
.skill-search:focus-within { border-color:var(--color-accent);box-shadow:0 0 0 3px var(--color-focus-ring); }
.skill-search input { min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--color-ink);font-size:var(--text-sm); }
.skill-search input::placeholder { color:var(--color-faint); }
.skill-search kbd { border:1px solid var(--color-rule-strong);border-radius:var(--radius-xs);background:var(--color-paper-2);padding:.05rem .3rem;color:var(--color-faint);font-family:var(--font-mono);font-size:var(--text-xs); }
.workspace-filter { flex:none;width:9.5rem; }
.workspace-filter :deep(.ui-select-trigger) { min-height:2.125rem;border-radius:var(--radius-sm); }

.skill-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(18.5rem,1fr));gap:.75rem;margin-top:1.25rem; }

.empty-catalogue { display:grid;min-height:18rem;place-content:center;justify-items:center;border:1px solid var(--color-rule);border-radius:var(--radius-lg);background:var(--color-paper);color:var(--color-muted);text-align:center;margin-top:1.25rem; }
.empty-icon { display:grid;width:2.5rem;height:2.5rem;place-items:center;border-radius:var(--radius-md);background:var(--color-paper-2);color:var(--color-faint); }
.empty-catalogue b { margin-top:.75rem;color:var(--color-ink);font-size:var(--text-sm);font-weight:600; }
.empty-catalogue p { margin:.25rem 0 .75rem;font-size:var(--text-sm); }
.empty-catalogue button { border:1px solid var(--color-rule-strong);border-radius:var(--radius-sm);background:var(--color-paper);padding:.4rem .75rem;color:var(--color-ink-2);font-size:var(--text-sm);transition:border-color var(--dur-fast); }
.empty-catalogue button:hover { border-color:var(--color-faint); }

@media (max-width: 760px) { .skills-workspace { padding:1.25rem 1rem 2rem; }.workspace-toolbar { flex-wrap:wrap; }.skill-search { width:100%; }.skill-grid { grid-template-columns:1fr; } }
</style>
