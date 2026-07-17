<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import {
  ArrowBackOutline,
  CloudDownloadOutline,
  FlashOutline,
  TrashOutline,
} from "@vicons/ionicons5";
import { MdPreview } from "md-editor-v3";
import "md-editor-v3/lib/preview.css";
import DependencyReviewPanel from "../components/skill/DependencyReviewPanel.vue";
import SkillSourcePanel from "../components/skill/SkillSourcePanel.vue";
import { api } from "../api";
import type { AgentInfo, SkillDetail, UpdateCheckResult } from "../api";
import UiSelect from "../components/ui/UiSelect.vue";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const skillName = computed(() => String(route.params.name));
const detail = ref<SkillDetail | null>(null);
const agents = ref<AgentInfo[]>([]);
const loading = ref(false);
const deploymentTargets = ref<string[]>([]);
const deploymentMode = shallowRef<"symlink" | "copy">("symlink");
const deploying = ref(false);
const undeploying = ref(false);
const checkingUpdate = ref(false);
const updating = ref(false);
const updateResult = ref<UpdateCheckResult | null>(null);
const removing = ref(false);

const installedAgents = computed(() =>
  agents.value.filter((agent) => agent.installed),
);
const agentOptions = computed(() =>
  installedAgents.value.map((agent) => ({
    label: agent.displayName,
    value: agent.name,
  })),
);
const sourceText = computed(() => {
  const source = detail.value?.skill.source;
  return source?.type === "github"
    ? `${source.owner}/${source.repo}${source.skillPath ? ` · ${source.skillPath}` : ""}`
    : "纯本地 Skill";
});
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
    message.error(`加载 Skill 失败: ${(error as Error).message}`);
  } finally {
    loading.value = false;
  }
}

async function deploy(dryRun = false) {
  if (deploymentTargets.value.length === 0) return;
  deploying.value = true;
  try {
    await api.deploySkill(skillName.value, deploymentTargets.value, {
      mode: deploymentMode.value,
      dryRun,
    });
    message.success(
      dryRun
        ? "预览完成：未写入任何分发文件"
        : `已分发到 ${deploymentTargets.value.join("、")}`,
    );
    if (!dryRun) {
      deploymentTargets.value = [];
      await loadDetail();
    }
  } catch (error) {
    message.error(`分发失败: ${(error as Error).message}`);
  } finally {
    deploying.value = false;
  }
}

async function undeploy(targets: string[]) {
  if (targets.length === 0) return;
  undeploying.value = true;
  try {
    await api.undeploySkill(skillName.value, targets);
    message.success(`已取消 ${targets.join("、")} 的分发`);
    await loadDetail();
  } catch (error) {
    message.error(`取消分发失败: ${(error as Error).message}`);
  } finally {
    undeploying.value = false;
  }
}

async function checkUpdate() {
  checkingUpdate.value = true;
  try {
    updateResult.value = (await api.checkSkillUpdate(skillName.value)).result;
  } catch (error) {
    message.error(`检查更新失败: ${(error as Error).message}`);
  } finally {
    checkingUpdate.value = false;
  }
}

async function updateSkill() {
  updating.value = true;
  try {
    const result = await api.updateSkill(skillName.value);
    message.success(`已更新至 ${result.result.newVersion}`);
    await loadDetail();
    await checkUpdate();
  } catch (error) {
    message.error(`更新失败: ${(error as Error).message}`);
  } finally {
    updating.value = false;
  }
}

async function removeSkill() {
  removing.value = true;
  try {
    await api.removeSkill(skillName.value, "all");
    message.success("Skill 与全部分发已移除");
    await router.push({ name: "skills" });
  } catch (error) {
    message.error(`删除失败: ${(error as Error).message}`);
  } finally {
    removing.value = false;
  }
}

watch(skillName, loadDetail, { immediate: true });
</script>

<template>
  <div class="app-page detail-page">
    <div class="detail-topline">
      <n-button quaternary size="small" @click="router.push({ name: 'skills' })"
        ><template #icon><n-icon :component="ArrowBackOutline" /></template
        >返回技能库</n-button
      >
      <p class="meta-label">Skill 工作台</p>
    </div>
    <n-spin :show="loading">
      <div v-if="detail" class="detail-content">
        <header class="skill-header">
          <div class="page-heading">
            <p class="page-kicker">
              {{ detail.skill.managed ? "已纳管 Skill" : "本地 Skill" }}
            </p>
            <h1 class="page-title">{{ detail.skill.name }}</h1>
            <p class="page-summary">
              {{
                detail.skill.description ||
                "没有描述；可在 SKILL.md 中补充用途说明。"
              }}
            </p>
          </div>
          <div class="header-actions">
            <n-tag
              :type="detail.skill.managed ? 'success' : 'default'"
              size="small"
              >{{ detail.skill.managed ? "已纳管" : "未纳管" }}</n-tag
            ><n-tag size="small">v{{ detail.skill.version }}</n-tag>
          </div>
        </header>
        <section class="overview-grid">
          <article class="overview-item">
            <p class="metric-label">分发覆盖</p>
            <strong>{{ distributionCoverage }}</strong
            ><span>已安装 Agent 覆盖</span>
          </article>
          <article class="overview-item">
            <p class="metric-label">来源</p>
            <strong>{{
              detail.skill.source.type === "github" ? "远程" : "本地"
            }}</strong
            ><span>{{ sourceText }}</span>
          </article>
          <article class="overview-item">
            <p class="metric-label">备份</p>
            <strong>{{ detail.backups.length }}</strong
            ><span>可用于更新前恢复</span>
          </article>
        </section>

        <section class="distribution surface">
          <div class="section-heading">
            <div>
              <p class="meta-label">分发控制</p>
              <h2>分发控制台</h2>
              <p>先预览，再写入。集中管理每个 Agent 的 Skill 副本。</p>
            </div>
            <n-button
              size="small"
              :loading="undeploying"
              :disabled="detail.skill.agents.length === 0"
              @click="undeploy(detail.skill.agents)"
              >全部取消分发</n-button
            >
          </div>
          <div class="distribution-workspace">
            <div class="distribution-form">
              <UiSelect
                v-model="deploymentTargets"
                :options="agentOptions"
                multiple
                placeholder="选择要覆盖的 Agent"
              /><n-radio-group
                v-model:value="deploymentMode"
                name="deployment-mode"
                ><n-radio value="symlink">符号链接</n-radio
                ><n-radio value="copy">复制副本</n-radio></n-radio-group
              >
              <div class="inline-actions">
                <n-button
                  :disabled="deploymentTargets.length === 0"
                  :loading="deploying"
                  @click="deploy(true)"
                  >预览变更</n-button
                ><n-button
                  type="primary"
                  :disabled="deploymentTargets.length === 0"
                  :loading="deploying"
                  @click="deploy(false)"
                  ><template #icon
                    ><n-icon :component="FlashOutline" /></template
                  >确认分发</n-button
                >
              </div>
            </div>
            <div class="agent-grid">
              <article
                v-for="agent in installedAgents"
                :key="agent.name"
                class="agent-state"
                :class="{
                  'agent-state--active': detail.skill.agents.includes(
                    agent.name,
                  ),
                }"
              >
                <div>
                  <strong>{{ agent.displayName }}</strong
                  ><span>{{
                    detail.skill.agents.includes(agent.name)
                      ? "已分发"
                      : "未覆盖"
                  }}</span>
                </div>
                <n-button
                  v-if="detail.skill.agents.includes(agent.name)"
                  size="tiny"
                  quaternary
                  :loading="undeploying"
                  @click="undeploy([agent.name])"
                  >移除</n-button
                >
              </article>
              <n-empty
                v-if="installedAgents.length === 0"
                description="尚未检测到已安装的 Agent"
              />
            </div>
          </div>
        </section>

        <section class="maintenance-grid">
          <div class="maintenance-main">
            <SkillSourcePanel
              :name="skillName"
              :source="detail.skill.source"
              @associated="loadDetail"
            /><DependencyReviewPanel :name="skillName" />
          </div>
          <aside class="maintenance-aside">
            <section class="update-panel">
              <p class="meta-label">更新</p>
              <h2>更新检查</h2>
              <p>
                {{
                  updateResult
                    ? updateResult.isLocal
                      ? "当前来源仍为纯本地，关联远程来源后可更新。"
                      : updateResult.hasUpdate
                        ? `${updateResult.currentVersion} → ${updateResult.remoteVersion}`
                        : "已是最新版本"
                    : "更新操作会保留备份，先检查再执行。"
                }}
              </p>
              <div class="inline-actions">
                <n-button
                  size="small"
                  :loading="checkingUpdate"
                  @click="checkUpdate"
                  >检查更新</n-button
                ><n-popconfirm
                  v-if="updateResult?.hasUpdate"
                  @positive-click="updateSkill"
                  ><template #trigger
                    ><n-button type="primary" size="small" :loading="updating"
                      ><template #icon
                        ><n-icon :component="CloudDownloadOutline" /></template
                      >安装更新</n-button
                    ></template
                  >将创建备份并更新此 Skill，确定继续？</n-popconfirm
                >
              </div>
            </section>
            <section class="backup-panel">
              <p class="meta-label">恢复</p>
              <h2>备份记录</h2>
              <ul v-if="detail.backups.length">
                <li v-for="backup in detail.backups" :key="backup.dir">
                  <span>v{{ backup.version }}</span
                  ><time>{{ backup.timestamp }}</time>
                </li>
              </ul>
              <n-empty v-else size="small" description="尚无更新备份" />
            </section>
            <section class="danger-panel">
              <p class="meta-label">危险操作</p>
              <h2>完全删除</h2>
              <p>删除中央仓库内容与全部已分发副本。</p>
              <n-popconfirm @positive-click="removeSkill"
                ><template #trigger
                  ><n-button type="error" size="small" :loading="removing"
                    ><template #icon
                      ><n-icon :component="TrashOutline" /></template
                    >删除 Skill</n-button
                  ></template
                >此操作会删除所有分发副本，确定继续？</n-popconfirm
              >
            </section>
          </aside>
        </section>

        <section class="document-panel">
          <p class="meta-label">Skill 文档</p>
          <MdPreview
            :model-value="detail.skillMd || '未找到 SKILL.md'"
            preview-theme="default"
          />
        </section>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
.detail-page {
  gap: 0.75rem;
}
.detail-topline,
.skill-header,
.section-heading,
.header-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.7rem;
}
.detail-topline {
  align-items: center;
}
.skill-header {
  padding-block: 0.1rem;
}
.header-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--color-rule);
  border-radius: 0.72rem;
  background: var(--color-paper);
  box-shadow: var(--shadow-xs);
}
.overview-item {
  display: grid;
  min-width: 0;
  gap: 0.22rem;
  border-right: 1px solid var(--color-rule);
  padding: 0.72rem 0.8rem;
}
.overview-item:last-child {
  border-right: 0;
}
.overview-item strong {
  color: var(--color-ink);
  font-size: 0.95rem;
  letter-spacing: -0.04em;
}
.overview-item span {
  overflow: hidden;
  color: var(--color-muted);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.distribution {
  display: grid;
  gap: 0.75rem;
  border: 1px solid var(--color-rule);
  border-radius: 0.72rem;
  background: var(--color-paper);
  padding: 0.8rem;
  box-shadow: var(--shadow-xs);
}
.section-heading h2,
.update-panel h2,
.backup-panel h2,
.danger-panel h2 {
  margin: 0.12rem 0;
  color: var(--color-ink);
  font-size: 0.76rem;
  letter-spacing: -0.025em;
}
.section-heading p:not(.meta-label),
.update-panel p:not(.meta-label),
.danger-panel p {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.75rem;
}
.distribution-workspace {
  display: grid;
  gap: 0.7rem;
}
.distribution-form {
  display: grid;
  align-content: start;
  gap: 0.55rem;
  border: 1px solid var(--color-rule);
  border-radius: 0.6rem;
  background: var(--color-paper-2);
  padding: 0.65rem;
}
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7.25rem, 1fr));
  gap: 0.38rem;
}
.agent-state {
  display: flex;
  min-height: 3.25rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  border: 1px solid var(--color-rule);
  border-radius: 0.55rem;
  background: var(--color-paper);
  padding: 0.52rem 0.58rem;
}
.agent-state--active {
  border-color: color-mix(in srgb, var(--color-success) 55%, var(--color-rule));
  background: var(--color-success-soft);
}
.agent-state strong,
.agent-state span {
  display: block;
}
.agent-state strong {
  color: var(--color-ink);
  font-size: 0.75rem;
}
.agent-state span {
  margin-top: 0.1rem;
  color: var(--color-muted);
  font-size: 0.75rem;
}
.maintenance-grid {
  display: grid;
  gap: 0.7rem;
}
.maintenance-main,
.maintenance-aside {
  display: grid;
  align-content: start;
  gap: 0.7rem;
}
.update-panel,
.backup-panel,
.danger-panel {
  display: grid;
  gap: 0.5rem;
  border: 1px solid var(--color-rule);
  border-radius: 0.72rem;
  background: var(--color-paper);
  padding: 0.8rem;
  box-shadow: var(--shadow-xs);
}
.backup-panel ul {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.backup-panel li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
.danger-panel {
  border-color: color-mix(in srgb, var(--color-danger) 28%, var(--color-rule));
  background: var(--color-danger-soft);
}
.document-panel {
  overflow: hidden;
  border: 1px solid var(--color-rule);
  border-radius: 0.72rem;
  background: var(--color-paper);
  box-shadow: var(--shadow-xs);
}
.document-panel > .meta-label {
  display: block;
  border-bottom: 1px solid var(--color-rule);
  padding: 0.62rem 0.75rem;
}
.document-panel :deep(.md-editor-preview) {
  padding: 0.8rem;
  background: transparent;
}
@media (min-width: 60rem) {
  .distribution-workspace {
    grid-template-columns: minmax(16rem, 0.55fr) minmax(0, 1.45fr);
  }
  .maintenance-grid {
    grid-template-columns: minmax(0, 1.4fr) minmax(17rem, 0.6fr);
  }
}
@media (max-width: 48rem) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
  .overview-item {
    border-right: 0;
    border-bottom: 1px solid var(--color-rule);
  }
  .overview-item:last-child {
    border-bottom: 0;
  }
}
@media (max-width: 39.99rem) {
  .skill-header,
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }
  .header-actions {
    justify-content: flex-start;
  }
  .agent-grid {
    grid-template-columns: 1fr 1fr;
  }
}
.detail-page {
  gap: 1.5rem;
}
.detail-content {
  display: grid;
  gap: 1.25rem;
}
.skill-header {
  padding-block: 0.25rem 0.5rem;
}
.overview-item {
  gap: 0.35rem;
  padding: 1rem 1.1rem;
}
.overview-item strong {
  font-size: 1.15rem;
}
.overview-item span {
  font-size: 0.75rem;
}
.distribution {
  gap: 1.1rem;
  padding: 1.1rem;
}
.section-heading h2,
.update-panel h2,
.backup-panel h2,
.danger-panel h2 {
  font-size: 0.95rem;
}
.section-heading p:not(.meta-label),
.update-panel p:not(.meta-label),
.danger-panel p {
  font-size: 0.75rem;
}
.distribution-workspace {
  gap: 1rem;
}
.distribution-form {
  gap: 0.8rem;
  padding: 0.85rem;
}
.agent-grid {
  gap: 0.6rem;
}
.agent-state {
  min-height: 3.8rem;
  padding: 0.7rem 0.75rem;
}
.agent-state strong {
  font-size: 0.75rem;
}
.agent-state span {
  font-size: 0.75rem;
}
.maintenance-grid,
.maintenance-main,
.maintenance-aside {
  gap: 1.25rem;
}
.update-panel,
.backup-panel,
.danger-panel {
  gap: 0.7rem;
  padding: 1.05rem;
}
.backup-panel li {
  font-size: 0.75rem;
}
.document-panel > .meta-label {
  padding: 0.85rem 1rem;
}
.document-panel :deep(.md-editor-preview) {
  padding: 1.15rem;
}
</style>
