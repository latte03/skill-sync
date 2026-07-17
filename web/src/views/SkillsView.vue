<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { RefreshOutline } from '@vicons/ionicons5';
import { api } from '../api';
import type { SkillInfo } from '../api';
import { useSkillWorkspace } from '../composables/useSkillWorkspace';
import SkillCard from '../components/workspace/SkillCard.vue';
import SkillInspector from '../components/workspace/SkillInspector.vue';
import DistributionPicker from '../components/workspace/DistributionPicker.vue';

const message = useMessage();
const workspace = useSkillWorkspace(message.error);
const pickerOpen = ref(false);
const pickerSkill = ref<SkillInfo | null>(null);
const running = ref(false);
const installedAgents = computed(() => workspace.installedAgents.value);
const tagNames = computed(() => Object.keys(workspace.tags.value));

function openDistribution(skill: SkillInfo) { pickerSkill.value = skill; pickerOpen.value = true; }
async function distribute(input: { agents: string[]; mode: 'symlink' | 'copy' }, dryRun = false) {
  if (!pickerSkill.value) return;
  running.value = true;
  try {
    await api.deploySkill(pickerSkill.value.name, input.agents, { mode: input.mode, dryRun });
    message.success(dryRun ? '预览完成：未写入任何文件' : '分发已完成，所有目标已一致提交');
    if (!dryRun) { pickerOpen.value = false; await workspace.refresh(); await workspace.selectSkill(pickerSkill.value); }
  } catch (error) {
    message.error(`分发失败: ${(error as Error).message}`);
  } finally { running.value = false; }
}
</script>

<template>
  <div class="workspace-page">
    <header class="workspace-toolbar">
      <div class="workspace-title"><p>SKILL CATALOGUE</p><h1>技能库 <span>{{ workspace.visibleSkills.value.length }}</span></h1></div>
      <div class="workspace-controls"><label class="toolbar-search"><span>⌕</span><input v-model="workspace.query.value" placeholder="搜索 Skill、描述或标签"><kbd>⌘ K</kbd></label><select v-model="workspace.agentFilter.value" aria-label="按 Agent 筛选"><option value="">全部 Agent</option><option v-for="agent in installedAgents" :key="agent.name" :value="agent.name">{{ agent.displayName }}</option></select><select v-model="workspace.tagFilter.value" aria-label="按标签筛选"><option value="">全部标签</option><option v-for="tag in tagNames" :key="tag" :value="tag">{{ tag }}</option></select><button class="refresh-button" type="button" :disabled="workspace.loading.value" @click="workspace.refresh"><n-icon :component="RefreshOutline" size="16" />刷新</button></div>
    </header>
    <div class="workspace-main">
      <section class="catalogue-area"><div class="catalogue-note"><span><i />本地工作区正常</span><span>{{ workspace.skills.value.filter(skill => skill.agents.length).length }} 个 Skill 已分发</span><span>{{ workspace.status.value?.unmanagedCount ?? 0 }} 个待关联来源</span></div><n-spin :show="workspace.loading.value"><div v-if="workspace.visibleSkills.value.length" class="skill-grid"><SkillCard v-for="skill in workspace.visibleSkills.value" :key="skill.name" :skill="skill" :agents="workspace.agents.value" :selected="workspace.selectedSkill.value?.name === skill.name" @select="workspace.selectSkill" @distribute="openDistribution" @agent="openDistribution(skill)" /></div><n-empty v-else description="没有符合条件的 Skill" /></n-spin></section>
      <SkillInspector :skill="workspace.selectedSkill.value" :detail="workspace.selectedDetail.value" :agents="workspace.agents.value" :loading="workspace.detailLoading.value" @close="workspace.closeInspector" @distribute="openDistribution" />
    </div>
    <DistributionPicker v-model:open="pickerOpen" :skill="pickerSkill" :agents="workspace.agents.value" :busy="running" @preview="distribute($event, true)" @distribute="distribute($event)" />
  </div>
</template>

<style scoped>
.workspace-page { width: min(100%, 110rem); margin: 0 auto; padding: 1rem; }.workspace-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .6rem .1rem 1rem; }.workspace-title p { margin: 0; color: var(--color-muted); font-family: var(--font-mono); font-size: .6rem; font-weight: 650; letter-spacing: .11em; }.workspace-title h1 { margin: .35rem 0 0; color: var(--color-ink); font-size: 1.15rem; letter-spacing: -.045em; }.workspace-title h1 span { margin-left: .35rem; color: var(--color-muted); font-family: var(--font-mono); font-size: .7rem; font-weight: 500; }.workspace-controls { display: flex; align-items: center; gap: .45rem; }.toolbar-search { display: flex; align-items: center; min-width: min(22rem, 34vw); gap: .45rem; border: 1px solid var(--color-rule); border-radius: .7rem; background: color-mix(in oklch, var(--color-paper) 82%, transparent); padding: .45rem .55rem; color: var(--color-muted); box-shadow: var(--shadow-sm); }.toolbar-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--color-ink); font: inherit; font-size: .72rem; }.toolbar-search kbd { border: 1px solid var(--color-rule); border-radius: .3rem; padding: .08rem .25rem; color: var(--color-muted); font-family: var(--font-mono); font-size: .56rem; }.workspace-controls select,.refresh-button { height: 2.15rem; border: 1px solid var(--color-rule); border-radius: .65rem; background: var(--color-paper); color: var(--color-muted); padding: 0 .55rem; font-size: .7rem; }.refresh-button { display: flex; align-items: center; gap: .3rem; color: var(--color-ink); }.workspace-main { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); }.catalogue-area { min-width: 0; }.catalogue-note { display: flex; flex-wrap: wrap; gap: .55rem 1rem; margin-bottom: .75rem; color: var(--color-muted); font-family: var(--font-mono); font-size: .61rem; }.catalogue-note span { display: flex; align-items: center; gap: .35rem; }.catalogue-note i { width: .45rem; height: .45rem; border-radius: 999px; background: var(--color-success); box-shadow: 0 0 0 3px var(--color-success-soft); }.skill-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr)); gap: .75rem; }@media (min-width: 1280px) { .workspace-main { grid-template-columns: minmax(0, 1fr) 19.5rem; }.workspace-page { padding: 1rem 1.25rem; } }.refresh-button:disabled { opacity: .55; }@media (max-width: 900px) { .workspace-toolbar { align-items: stretch; flex-direction: column; }.workspace-controls { width: 100%; overflow-x: auto; }.toolbar-search { min-width: 16rem; flex: 1; }.workspace-controls select { display: none; } }.workspace-title h1 { line-height: 1; }
</style>
