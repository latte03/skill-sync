<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  CloudDownloadOutline,
  FlashOutline,
  TrashOutline,
  CloseCircleOutline,
} from "@vicons/ionicons5";
import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import DependencyReviewPanel from "../components/skill/DependencyReviewPanel.vue";
import SkillSourcePanel from "../components/skill/SkillSourcePanel.vue";
import SkillFileBrowser from "../components/skill/SkillFileBrowser.vue";
import { api } from "../api";
import type { AgentInfo, SkillDetail, UpdateCheckResult } from "../api";
import UiButton from "../components/ui/UiButton.vue";
import UiSegmented from "../components/ui/UiSegmented.vue";
import UiConfirm from "../components/ui/UiConfirm.vue";
import AgentIcon from "../components/agent-icon.vue";
import { useToast } from "../composables/useToast";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const skillName = computed(() => String(route.params.name));
const detail = ref<SkillDetail | null>(null);
const agents = ref<AgentInfo[]>([]);
const loading = ref(false);
const deploymentMode = ref<"symlink" | "copy">("symlink");
const modeOptions = [
  { value: "symlink", label: "符号链接" },
  { value: "copy", label: "复制" },
];
const deploying = ref(false);
const undeploying = ref(false);
const checkingUpdate = ref(false);
const updating = ref(false);
const updateResult = ref<UpdateCheckResult | null>(null);
const removing = ref(false);

const installedAgents = computed(() =>
  agents.value
    .filter((agent) => agent.installed)
    .sort((a, b) => {
      const deployed = detail.value?.skill.agents ?? [];
      const aDeployed = deployed.includes(a.name) ? 0 : 1;
      const bDeployed = deployed.includes(b.name) ? 0 : 1;
      return aDeployed - bDeployed;
    }),
);
const distributionCoverage = computed(
  () =>
    `${detail.value?.skill.agents.length ?? 0}/${installedAgents.value.length}`,
);

async function loadDetail() {
  loading.value = true;
  updateResult.value = null;
  try {
    const [detailResponse, agentResponse] = await Promise.all([
      api.getSkillDetail(skillName.value),
      api.getAgents(),
    ]);
    detail.value = detailResponse;
    agents.value = agentResponse.agents;
  } catch (error) {
    toast.error(`加载 Skill 失败: ${(error as Error).message}`);
  } finally {
    loading.value = false;
  }
}

async function deploy(targets: string[]) {
  if (targets.length === 0) return;
  deploying.value = true;
  try {
    await api.deploySkill(skillName.value, targets, {
      mode: deploymentMode.value,
    });
    toast.success(`已分发到 ${targets.join("、")}`);
    await loadDetail();
  } catch (error) {
    toast.error(`分发失败: ${(error as Error).message}`);
  } finally {
    deploying.value = false;
  }
}

async function undeploy(targets: string[]) {
  if (targets.length === 0) return;
  undeploying.value = true;
  try {
    await api.undeploySkill(skillName.value, targets);
    toast.success(`已取消 ${targets.join("、")} 的分发`);
    await loadDetail();
  } catch (error) {
    toast.error(`取消分发失败: ${(error as Error).message}`);
  } finally {
    undeploying.value = false;
  }
}

async function checkUpdate() {
  checkingUpdate.value = true;
  try {
    updateResult.value = (await api.checkSkillUpdate(skillName.value)).result;
  } catch (error) {
    toast.error(`检查更新失败: ${(error as Error).message}`);
  } finally {
    checkingUpdate.value = false;
  }
}

async function updateSkill() {
  updating.value = true;
  try {
    const result = await api.updateSkill(skillName.value);
    toast.success(`已更新至 ${result.result.newVersion}`);
    await loadDetail();
    await checkUpdate();
  } catch (error) {
    toast.error(`更新失败: ${(error as Error).message}`);
  } finally {
    updating.value = false;
  }
}

async function removeSkill() {
  removing.value = true;
  try {
    await api.removeSkill(skillName.value, "all");
    toast.success("Skill 与全部分发已移除");
    await router.push({ name: "skills" });
  } catch (error) {
    toast.error(`删除失败: ${(error as Error).message}`);
  } finally {
    removing.value = false;
  }
}

watch(skillName, loadDetail, { immediate: true });
</script>

<template>
  <div class="detail-page">
    <div v-if="loading" class="detail-loading"><span class="spinner" /></div>
    <template v-else-if="detail">
        <!-- Header -->
        <header class="detail-header">

          <h1>{{ detail.skill.name }}</h1>
          <div class="header-tags mt-2 mb-4">
              <span class="tag" :class="detail.skill.managed ? 'tag--ok' : ''">{{ detail.skill.managed ? "已纳管" : "未纳管" }}</span>
              <span class="tag">v{{ detail.skill.version }}</span>
            </div>
          <p class="header-desc">{{ detail.skill.description || "没有描述；可在 SKILL.md 中补充用途说明。" }}</p>
          <div class="header-metrics">
            <span class="metric-item"><em>分发</em>{{ distributionCoverage }}</span>
            <span class="metric-sep" />
            <span class="metric-item"><em>来源</em>{{ detail.skill.source.type === "github" ? "远程" : "本地" }}</span>
            <span class="metric-sep" />
            <span class="metric-item"><em>备份</em>{{ detail.backups.length }}</span>
          </div>
        </header>

        <!-- Two-column body -->
        <div class="detail-body">
          <!-- Left: File Browser -->
          <main class="detail-main">
            <SkillFileBrowser :name="skillName" />
          </main>

          <!-- Right: Sidebar -->
          <aside class="detail-sidebar">
            <!-- Distribution -->
            <section class="sidebar-section">
              <div class="sidebar-head">
                <h2>分发</h2>
                <UiButton v-if="detail.skill.agents.length > 0" variant="danger" size="sm" :loading="undeploying" @click="undeploy(detail.skill.agents)">
                  <template #icon><CloseCircleOutline class="icon-12" /></template>
                  全部取消
                </UiButton>
              </div>
              <div class="agent-list">
                <PopoverRoot v-for="agent in installedAgents" :key="agent.name">
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      class="agent-chip"
                      :class="{ 'agent-chip--deployed': detail.skill.agents.includes(agent.name) }"
                    >
                      <AgentIcon :agent-id="agent.name" :agent-name="agent.displayName" :size="28" />
                    </button>
                  </PopoverTrigger>
                  <PopoverPortal>
                    <PopoverContent class="agent-popover" side="bottom" :side-offset="8" align="center">
                      <div class="popover-head mb-2">
                        <AgentIcon :agent-id="agent.name" :agent-name="agent.displayName" :size="20" />
                        <strong>{{ agent.displayName }}</strong>
                      </div>
                      <code class="popover-dir block">{{ agent.skillsDir }}</code>
                      <UiSegmented class="mt-2 mb-2" v-model="deploymentMode" :options="modeOptions" size="sm" block />
                      <UiButton
                        v-if="detail.skill.agents.includes(agent.name)"
                        size="sm" class="popover-action"
                        variant="danger"
                        :loading="undeploying"
                        @click="undeploy([agent.name])"
                      >取消分发</UiButton>
                      <UiButton
                        v-else
                        variant="primary" size="sm" class="popover-action"
                        :loading="deploying"
                        @click="deploy([agent.name])"
                      >
                        <template #icon><FlashOutline class="icon-12" /></template>
                        分发
                      </UiButton>
                      <PopoverArrow class="popover-arrow" :width="10" :height="5" />
                    </PopoverContent>
                  </PopoverPortal>
                </PopoverRoot>
                <p v-if="installedAgents.length === 0" class="empty-hint">尚未检测到已安装的 Agent</p>
              </div>
            </section>

            <!-- Source -->
            <section class="sidebar-section">
              <SkillSourcePanel :name="skillName" :source="detail.skill.source" @associated="loadDetail" />
            </section>

            <!-- Dependencies -->
            <section class="sidebar-section">
              <DependencyReviewPanel :name="skillName" />
            </section>

            <!-- Update & Backup -->
            <section class="sidebar-section">
              <div class="sidebar-head">
                <h2>更新</h2>
                <UiButton variant="ghost" size="sm" :loading="checkingUpdate" @click="checkUpdate">检查更新</UiButton>
              </div>
              <p class="sidebar-desc">{{ updateResult ? (updateResult.isLocal ? "关联远程来源后可更新。" : updateResult.hasUpdate ? `${updateResult.currentVersion} → ${updateResult.remoteVersion}` : "已是最新版本") : "先检查再执行，更新前自动备份。" }}</p>
              <div v-if="updateResult?.hasUpdate" class="sidebar-actions">
                <UiConfirm title="安装更新" description="将创建备份并更新此 Skill，确定继续？" confirm-text="更新" @confirm="updateSkill">
                  <template #trigger>
                    <UiButton size="sm" variant="primary" :loading="updating">
                      <template #icon><CloudDownloadOutline class="icon-13" /></template>
                      安装更新
                    </UiButton>
                  </template>
                </UiConfirm>
              </div>
              <template v-if="detail.backups.length">
                <h3 class="sidebar-subtitle">备份</h3>
                <ul class="backup-list">
                  <li v-for="backup in detail.backups" :key="backup.dir">
                    <span>v{{ backup.version }}</span>
                    <time>{{ backup.timestamp }}</time>
                  </li>
                </ul>
              </template>
            </section>

            <!-- Danger -->
            <section class="sidebar-section sidebar-section--danger">
              <h2 class="sidebar-title">危险操作</h2>
              <p class="sidebar-desc">删除中央仓库内容与全部已分发副本。</p>
              <UiConfirm title="删除 Skill" description="此操作会删除所有分发副本，确定继续？" confirm-text="删除" variant="danger" @confirm="removeSkill">
                <template #trigger>
                  <UiButton size="sm" variant="danger" :loading="removing">
                    <template #icon><TrashOutline class="icon-13" /></template>
                    删除 Skill
                  </UiButton>
                </template>
              </UiConfirm>
            </section>
          </aside>
        </div>
    </template>
  </div>
</template>

<style scoped>
.detail-page { width: 100%; max-width: var(--content-max-width); margin: 0 auto; padding: 1.5rem 2rem 3rem; }

/* Header */
.detail-header { padding-bottom: 1.25rem;  }
.header-top { display: flex; align-items: center; justify-content: flex-end; margin-bottom: .75rem; }
.header-tags { display: flex; gap: .375rem; }
.tag { border-radius: 999px; background: var(--color-paper-2); padding: .15rem .55rem; color: var(--color-muted); font-size: var(--text-xs); font-weight: 550; }
.tag--ok { background: var(--color-success-soft); color: var(--color-success); }
.detail-header h1 { margin: 0; color: var(--color-ink); font-size: var(--text-2xl); font-weight: 700; letter-spacing: -.025em; word-break: break-all; }
.header-desc { margin: .3rem 0 0; color: var(--color-muted); font-size: var(--text-sm); line-height: 1.5; max-width: 52rem; }
.header-metrics { display: flex; align-items: center; gap: .75rem; margin-top: .75rem; }
.metric-item { display: inline-flex; align-items: center; gap: .35rem; color: var(--color-ink); font-size: var(--text-sm); font-weight: 600; }
.metric-item em { color: var(--color-faint); font-size: var(--text-xs); font-style: normal; font-weight: 500; }
.metric-sep { width: 1px; height: .85rem; background: var(--color-rule-strong); }

/* Two-column layout */
.detail-body { display: grid; grid-template-columns: minmax(0, 1fr) 20rem; gap: 2rem; align-items: start; margin-top: 1.25rem; }

/* Left: file browser */
.detail-main { min-width: 0; }

/* Right: sidebar */
.detail-sidebar { display: grid; gap: 0; position: sticky; top: 1rem; }
.sidebar-section { padding: 1.1rem 0; border-bottom: 1px solid var(--color-rule); }
.sidebar-section:first-child { padding-top: 0; }
.sidebar-section:last-child { border-bottom: 0; }
.sidebar-section--danger .sidebar-title { color: var(--color-danger); }
.sidebar-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .625rem; }
.sidebar-head h2, .sidebar-title { margin: 0; color: var(--color-ink); font-size: var(--text-base); font-weight: 650; }
.sidebar-subtitle { margin: .75rem 0 .35rem; color: var(--color-ink-2); font-size: var(--text-xs); font-weight: 600; }
.sidebar-desc { margin: .25rem 0 .5rem; color: var(--color-muted); font-size: var(--text-xs); line-height: 1.5; }
.sidebar-actions { display: flex; gap: .5rem; }

/* Agent list */
.agent-list { display: flex; flex-wrap: wrap; gap: .5rem; }
.agent-chip { display: grid; place-items: center; border: 0; border-radius: var(--radius-sm); background: transparent; padding: 3px; cursor: pointer; transition: background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.agent-chip:hover { background: var(--color-paper-2); transform: translateY(-1px); }
.agent-chip :deep(.agent-brand-icon) { filter: grayscale(1); opacity: .38; transition: filter var(--dur-fast), opacity var(--dur-fast); }
.agent-chip--deployed :deep(.agent-brand-icon) { filter: none; opacity: 1; }
.empty-hint { margin: 0; color: var(--color-faint); font-size: var(--text-xs); }

/* Backup */
.backup-list { display: grid; gap: .2rem; margin: 0; padding: 0; list-style: none; }
.backup-list li { display: flex; justify-content: space-between; gap: .5rem; color: var(--color-muted); font-family: var(--font-mono); font-size: var(--text-xs); }

/* Loading */
.detail-loading { display: grid; place-items: center; padding: 4rem 0; }
.spinner { width: 1.25rem; height: 1.25rem; border: 2px solid var(--color-rule); border-top-color: var(--color-accent); border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Icon sizes */
.icon-12 { width: 12px; height: 12px; }
.icon-13 { width: 13px; height: 13px; }

/* Responsive */
@media (max-width: 60rem) {
  .detail-body { grid-template-columns: 1fr; }
  .detail-sidebar { position: static; }
}
</style>

<style>
/* Agent popover (teleported, must be unscoped) */
.agent-popover { z-index: 9999; width: 13rem; border: 1px solid var(--color-rule-strong); border-radius: var(--radius-md); background: var(--color-paper-raised); box-shadow: var(--shadow-lg); padding: .75rem;gap: .5rem; animation: popover-in 120ms var(--ease-out); }
.popover-head { display: flex; align-items: center; gap: .5rem; }
.popover-head strong { color: var(--color-ink); font-size: var(--text-base); font-weight: 600; }
.popover-dir { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-faint); word-break: break-all; line-height: 1.4; }
.popover-action { width: 100%; font-size: .7rem !important; }
.popover-arrow { fill: var(--color-paper-raised); }
@keyframes popover-in { from { opacity: 0; transform: scale(.96) translateY(-2px); } to { opacity: 1; transform: scale(1) translateY(0); } }
</style>
