<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { ArrowBackOutline, CloudDownloadOutline, FlashOutline, TrashOutline } from '@vicons/ionicons5';
import { MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/preview.css';
import DependencyReviewPanel from '../components/skill/DependencyReviewPanel.vue';
import SkillSourcePanel from '../components/skill/SkillSourcePanel.vue';
import { api } from '../api';
import type { AgentInfo, SkillDetail, UpdateCheckResult } from '../api';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const skillName = computed(() => String(route.params.name));
const detail = ref<SkillDetail | null>(null);
const agents = ref<AgentInfo[]>([]);
const loading = ref(false);
const deploymentTargets = ref<string[]>([]);
const deploymentMode = shallowRef<'symlink' | 'copy'>('symlink');
const deploying = ref(false);
const undeploying = ref(false);
const checkingUpdate = ref(false);
const updating = ref(false);
const updateResult = ref<UpdateCheckResult | null>(null);
const removing = ref(false);

const installedAgents = computed(() => agents.value.filter(agent => agent.installed));
const agentOptions = computed(() => installedAgents.value.map(agent => ({ label: agent.displayName, value: agent.name })));
const sourceText = computed(() => {
  const source = detail.value?.skill.source;
  return source?.type === 'github' ? `${source.owner}/${source.repo}${source.skillPath ? ` · ${source.skillPath}` : ''}` : '纯本地 Skill';
});
const distributionCoverage = computed(() => `${detail.value?.skill.agents.length ?? 0}/${installedAgents.value.length}`);

async function loadDetail() {
  loading.value = true;
  updateResult.value = null;
  try {
    const [detailResponse, agentResponse] = await Promise.all([api.getSkillDetail(skillName.value), api.getAgents()]);
    detail.value = detailResponse;
    agents.value = agentResponse.agents;
  } catch (error) {
    message.error(`加载 Skill 失败: ${(error as Error).message}`);
  } finally { loading.value = false; }
}

async function deploy(dryRun = false) {
  if (deploymentTargets.value.length === 0) return;
  deploying.value = true;
  try {
    await api.deploySkill(skillName.value, deploymentTargets.value, { mode: deploymentMode.value, dryRun });
    message.success(dryRun ? '预览完成：未写入任何分发文件' : `已分发到 ${deploymentTargets.value.join('、')}`);
    if (!dryRun) { deploymentTargets.value = []; await loadDetail(); }
  } catch (error) { message.error(`分发失败: ${(error as Error).message}`); }
  finally { deploying.value = false; }
}

async function undeploy(targets: string[]) {
  if (targets.length === 0) return;
  undeploying.value = true;
  try { await api.undeploySkill(skillName.value, targets); message.success(`已取消 ${targets.join('、')} 的分发`); await loadDetail(); }
  catch (error) { message.error(`取消分发失败: ${(error as Error).message}`); }
  finally { undeploying.value = false; }
}

async function checkUpdate() {
  checkingUpdate.value = true;
  try { updateResult.value = (await api.checkSkillUpdate(skillName.value)).result; }
  catch (error) { message.error(`检查更新失败: ${(error as Error).message}`); }
  finally { checkingUpdate.value = false; }
}

async function updateSkill() {
  updating.value = true;
  try { const result = await api.updateSkill(skillName.value); message.success(`已更新至 ${result.result.newVersion}`); await loadDetail(); await checkUpdate(); }
  catch (error) { message.error(`更新失败: ${(error as Error).message}`); }
  finally { updating.value = false; }
}

async function removeSkill() {
  removing.value = true;
  try { await api.removeSkill(skillName.value, 'all'); message.success('Skill 与全部分发已移除'); await router.push({ name: 'skills' }); }
  catch (error) { message.error(`删除失败: ${(error as Error).message}`); }
  finally { removing.value = false; }
}

watch(skillName, loadDetail, { immediate: true });
</script>

<template>
  <div class="app-page detail-page">
    <div class="detail-topline"><n-button quaternary size="small" @click="router.push({ name: 'skills' })"><template #icon><n-icon :component="ArrowBackOutline" /></template>返回技能库</n-button><p class="meta-label">SKILL WORKBENCH</p></div>
    <n-spin :show="loading">
      <template v-if="detail">
        <header class="skill-header"><div class="page-heading"><p class="page-kicker">{{ detail.skill.managed ? 'MANAGED SKILL' : 'LOCAL SKILL' }}</p><h1 class="page-title">{{ detail.skill.name }}</h1><p class="page-summary">{{ detail.skill.description || '没有描述；可在 SKILL.md 中补充用途说明。' }}</p></div><div class="header-actions"><n-tag :type="detail.skill.managed ? 'success' : 'default'" size="small">{{ detail.skill.managed ? '已纳管' : '未纳管' }}</n-tag><n-tag size="small">v{{ detail.skill.version }}</n-tag></div></header>
        <section class="overview-grid"><article class="overview-item"><p class="metric-label">DISTRIBUTION</p><strong>{{ distributionCoverage }}</strong><span>已安装 Agent 覆盖</span></article><article class="overview-item"><p class="metric-label">SOURCE</p><strong>{{ detail.skill.source.type === 'github' ? 'REMOTE' : 'LOCAL' }}</strong><span>{{ sourceText }}</span></article><article class="overview-item"><p class="metric-label">BACKUPS</p><strong>{{ detail.backups.length }}</strong><span>可用于更新前恢复</span></article></section>

        <section class="distribution surface"><div class="section-heading"><div><p class="meta-label">DISTRIBUTION CONTROL</p><h2>分发控制台</h2><p>先预览，再写入。集中管理每个 Agent 的 Skill 副本。</p></div><n-button size="small" :loading="undeploying" :disabled="detail.skill.agents.length === 0" @click="undeploy(detail.skill.agents)">全部取消分发</n-button></div>
          <div class="distribution-workspace"><div class="distribution-form"><n-select v-model:value="deploymentTargets" :options="agentOptions" multiple filterable placeholder="选择要覆盖的 Agent" /><n-radio-group v-model:value="deploymentMode" name="deployment-mode"><n-radio value="symlink">符号链接</n-radio><n-radio value="copy">复制副本</n-radio></n-radio-group><div class="inline-actions"><n-button :disabled="deploymentTargets.length === 0" :loading="deploying" @click="deploy(true)">预览变更</n-button><n-button type="primary" :disabled="deploymentTargets.length === 0" :loading="deploying" @click="deploy(false)"><template #icon><n-icon :component="FlashOutline" /></template>确认分发</n-button></div></div>
            <div class="agent-grid"><article v-for="agent in installedAgents" :key="agent.name" class="agent-state" :class="{ 'agent-state--active': detail.skill.agents.includes(agent.name) }"><div><strong>{{ agent.displayName }}</strong><span>{{ detail.skill.agents.includes(agent.name) ? '已分发' : '未覆盖' }}</span></div><n-button v-if="detail.skill.agents.includes(agent.name)" size="tiny" quaternary :loading="undeploying" @click="undeploy([agent.name])">移除</n-button></article><n-empty v-if="installedAgents.length === 0" description="尚未检测到已安装的 Agent" /></div>
          </div>
        </section>

        <section class="maintenance-grid"><div class="maintenance-main"><SkillSourcePanel :name="skillName" :source="detail.skill.source" @associated="loadDetail" /><DependencyReviewPanel :name="skillName" /></div><aside class="maintenance-aside"><section class="update-panel"><p class="meta-label">UPDATE</p><h2>更新检查</h2><p>{{ updateResult ? updateResult.isLocal ? '当前来源仍为纯本地，关联远程来源后可更新。' : updateResult.hasUpdate ? `${updateResult.currentVersion} → ${updateResult.remoteVersion}` : '已是最新版本' : '更新操作会保留备份，先检查再执行。' }}</p><div class="inline-actions"><n-button size="small" :loading="checkingUpdate" @click="checkUpdate">检查更新</n-button><n-popconfirm v-if="updateResult?.hasUpdate" @positive-click="updateSkill"><template #trigger><n-button type="primary" size="small" :loading="updating"><template #icon><n-icon :component="CloudDownloadOutline" /></template>安装更新</n-button></template>将创建备份并更新此 Skill，确定继续？</n-popconfirm></div></section><section class="backup-panel"><p class="meta-label">RECOVERY</p><h2>备份记录</h2><ul v-if="detail.backups.length"><li v-for="backup in detail.backups" :key="backup.dir"><span>v{{ backup.version }}</span><time>{{ backup.timestamp }}</time></li></ul><n-empty v-else size="small" description="尚无更新备份" /></section><section class="danger-panel"><p class="meta-label">DESTRUCTIVE</p><h2>完全删除</h2><p>删除中央仓库内容与全部已分发副本。</p><n-popconfirm @positive-click="removeSkill"><template #trigger><n-button type="error" size="small" :loading="removing"><template #icon><n-icon :component="TrashOutline" /></template>删除 Skill</n-button></template>此操作会删除所有分发副本，确定继续？</n-popconfirm></section></aside></section>

        <section class="document-panel"><p class="meta-label">SKILL DOCUMENT</p><MdPreview :model-value="detail.skillMd || '未找到 SKILL.md'" preview-theme="default" /></section>
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
.detail-page { gap: var(--space-lg); }.detail-topline, .skill-header, .section-heading, .header-actions { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-md); }.detail-topline { align-items: center; }.skill-header { padding-block: var(--space-sm); }.header-actions { flex-wrap: wrap; justify-content: flex-end; }.overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); border: var(--rule); border-radius: var(--radius-lg); overflow: hidden; }.overview-item { display: grid; gap: var(--space-xs); min-inline-size: 0; padding: var(--space-lg); border-block-end: var(--rule); background: var(--color-paper-2); }.overview-item strong { color: var(--color-ink); font-family: var(--font-display); font-size: var(--text-xl); letter-spacing: -0.04em; }.overview-item span { overflow-wrap: anywhere; color: var(--color-muted); font-size: var(--text-xs); }.distribution { display: grid; gap: var(--space-lg); padding: var(--space-lg); }.section-heading h2, .update-panel h2, .backup-panel h2, .danger-panel h2 { margin: var(--space-2xs) 0; color: var(--color-ink); font-size: var(--text-lg); letter-spacing: -0.03em; }.section-heading p:not(.meta-label), .update-panel p:not(.meta-label), .danger-panel p { margin: 0; color: var(--color-muted); font-size: var(--text-sm); }.distribution-workspace { display: grid; gap: var(--space-lg); }.distribution-form { display: grid; gap: var(--space-md); padding: var(--space-md); border: var(--rule); border-radius: var(--radius-sm); background: var(--color-paper-2); }.agent-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: var(--space-xs); }.agent-state { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); min-block-size: 4.25rem; padding: var(--space-md); border: var(--rule); border-radius: var(--radius-sm); background: var(--color-paper); }.agent-state--active { border-color: var(--color-success); background: var(--color-success-soft); }.agent-state strong, .agent-state span { display: block; }.agent-state strong { color: var(--color-ink); font-size: var(--text-sm); }.agent-state span { color: var(--color-muted); font-size: var(--text-xs); }.maintenance-grid { display: grid; gap: var(--space-lg); }.maintenance-main, .maintenance-aside { display: grid; align-content: start; gap: var(--space-lg); }.update-panel, .backup-panel, .danger-panel { display: grid; gap: var(--space-sm); padding: var(--space-lg); border: var(--rule); border-radius: var(--radius-lg); background: var(--color-paper); }.backup-panel ul { display: grid; gap: var(--space-xs); padding: 0; margin: 0; list-style: none; }.backup-panel li { display: flex; justify-content: space-between; gap: var(--space-sm); color: var(--color-muted); font-family: var(--font-mono); font-size: 0.625rem; }.danger-panel { border-color: var(--color-danger); background: var(--color-danger-soft); }.document-panel { overflow: hidden; border: var(--rule); border-radius: var(--radius-lg); background: var(--color-paper); }.document-panel > .meta-label { display: block; padding: var(--space-md) var(--space-lg); border-block-end: var(--rule); }.document-panel :deep(.md-editor-preview) { padding: var(--space-lg); background: transparent; } @media (min-width: 60rem) { .overview-item { border-block-end: 0; border-inline-end: var(--rule); }.overview-item:last-child { border-inline-end: 0; }.distribution-workspace { grid-template-columns: minmax(17rem, 0.7fr) minmax(0, 1.3fr); }.maintenance-grid { grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.65fr); } } @media (max-width: 39.99rem) { .skill-header, .section-heading { flex-direction: column; }.header-actions { justify-content: flex-start; } }
</style>
