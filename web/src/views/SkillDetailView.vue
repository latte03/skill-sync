<template>
  <div class="detail-page">
    <n-spin :show="loading">
      <div v-if="detail" class="detail-content">
        <!-- 返回按钮 -->
        <n-button size="small" quaternary @click="goBack">
          返回列表
        </n-button>

        <!-- 标题区 -->
        <div class="detail-header">
          <div class="header-top">
            <h2 class="skill-title">{{ detail.skill.name }}</h2>
            <n-space size="small">
              <n-tag :type="detail.skill.managed ? 'success' : 'warning'" size="small" round>
                {{ detail.skill.managed ? 'managed' : 'unmanaged' }}
              </n-tag>
              <n-tag type="info" size="small">v{{ detail.skill.version }}</n-tag>
            </n-space>
          </div>
          <p v-if="detail.skill.description" class="skill-desc">{{ detail.skill.description }}</p>
        </div>

        <!-- Tabs -->
        <n-tabs type="line" animated>
          <!-- SKILL.md 预览 -->
          <n-tab-pane name="preview" tab="SKILL.md">
            <div class="md-preview-container">
              <n-empty v-if="!detail.skillMd" description="SKILL.md 不存在" />
              <MdPreview
                v-else
                :modelValue="detail.skillMd"
                :theme="'light'"
                class="md-preview p-4"
              />
            </div>
          </n-tab-pane>

          <!-- 版本与备份 -->
          <n-tab-pane name="version" tab="版本与备份">
            <n-descriptions :column="1" bordered size="small">
              <n-descriptions-item label="当前版本">
                v{{ detail.skill.version }}
              </n-descriptions-item>
              <n-descriptions-item label="分发模式">
                {{ detail.skill.deployMode }}
              </n-descriptions-item>
            </n-descriptions>

            <n-divider v-if="detail.backups.length > 0" />
            <div v-if="detail.backups.length > 0">
              <h4>备份历史 ({{ detail.backups.length }})</h4>
              <n-space vertical>
                <div v-for="b in detail.backups" :key="b.dir" class="backup-item">
                  <n-tag size="small">v{{ b.version }}</n-tag>
                  <span class="backup-time">{{ b.timestamp }}</span>
                  <code class="backup-dir">{{ b.dir }}</code>
                </div>
              </n-space>
            </div>
            <n-empty v-else description="暂无备份" />
          </n-tab-pane>

          <!-- 分发管理 -->
          <n-tab-pane name="deploy" tab="分发管理">
            <div class="deploy-section">
              <h4>分发到 Agent</h4>
              <n-space>
                <n-select
                  v-model:value="selectedAgents"
                  :options="agentOptions"
                  multiple
                  placeholder="选择 Agent..."
                  style="width: 320px"
                  size="small"
                />
                <n-button
                  size="small"
                  type="primary"
                  :disabled="selectedAgents.length === 0"
                  :loading="deployLoading"
                  @click="doDeploy"
                >
                  分发
                </n-button>
                <n-button
                  size="small"
                  type="warning"
                  :disabled="selectedAgents.length === 0"
                  :loading="undeployLoading"
                  @click="doUndeploy"
                >
                  取消分发
                </n-button>
              </n-space>

              <n-divider />
              <h4>当前分发状态</h4>
              <n-space v-if="detail.skill.agents.length > 0">
                <n-tag
                  v-for="agent in detail.skill.agents"
                  :key="agent"
                  type="info"
                  size="small"
                  closable
                  @close="undeploySingle(agent)"
                >
                  {{ agent }}
                </n-tag>
              </n-space>
              <n-empty v-else description="未分发到任何 Agent" />
            </div>
          </n-tab-pane>

          <!-- 标签管理 -->
          <n-tab-pane name="tags" tab="标签">
            <div class="tags-section">
              <n-space align="center">
                <n-input
                  v-model:value="newTag"
                  placeholder="输入标签名..."
                  size="small"
                  style="width: 200px"
                  @keyup.enter="addTag"
                />
                <n-button size="small" type="primary" @click="addTag" :disabled="!newTag.trim()">
                  添加标签
                </n-button>
              </n-space>

              <n-divider />
              <n-space v-if="detail.skill.tags.length > 0">
                <n-tag
                  v-for="tag in detail.skill.tags"
                  :key="tag"
                  size="small"
                  closable
                  @close="removeTag(tag)"
                >
                  {{ tag }}
                </n-tag>
              </n-space>
              <n-empty v-else description="暂无标签" />
            </div>
          </n-tab-pane>

          <!-- 操作 -->
          <n-tab-pane name="actions" tab="操作">
            <div class="actions-section">
              <n-space vertical>
                <n-space align="center">
                  <n-button
                    size="small"
                    @click="checkUpdate"
                    :loading="updateLoading"
                  >
                    检查更新
                  </n-button>
                  <n-tag v-if="updateResult" :type="updateResult.hasUpdate ? 'warning' : 'success'" size="small">
                    {{ updateResult.hasUpdate
                      ? `有更新: ${updateResult.remoteVersion}`
                      : '已是最新版本' }}
                  </n-tag>
                </n-space>

                <n-divider />

                <n-space>
                  <n-popconfirm @positive-click="removeSkill('central')">
                    <template #trigger>
                      <n-button size="small" type="warning">
                        从中央仓库移除（保留 Agent 副本）
                      </n-button>
                    </template>
                    确定从中央仓库移除 {{ detail.skill.name }}？Agent 目录下的副本将变为孤儿。
                  </n-popconfirm>

                  <n-popconfirm @positive-click="removeSkill('all')">
                    <template #trigger>
                      <n-button size="small" type="error">
                        完全删除（含所有分发）
                      </n-button>
                    </template>
                    确定完全删除 {{ detail.skill.name }}？所有 Agent 中的分发也将被移除。
                  </n-popconfirm>
                </n-space>
              </n-space>
            </div>
          </n-tab-pane>
        </n-tabs>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/preview.css';
import { api, type SkillDetail, type AgentInfo, type UpdateCheckResult } from '../api';

const route = useRoute();
const router = useRouter();
const message = useMessage();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'removed'): void;
}>();

const skillName = computed(() => route.params.name as string);

function goBack() {
  router.push({ name: 'skills' });
}

const loading = ref(false);
const detail = ref<SkillDetail | null>(null);
const agents = ref<AgentInfo[]>([]);
const selectedAgents = ref<string[]>([]);
const deployLoading = ref(false);
const undeployLoading = ref(false);
const newTag = ref('');
const updateLoading = ref(false);
const updateResult = ref<UpdateCheckResult | null>(null);

const agentOptions = ref<{ label: string; value: string }[]>([]);

async function loadDetail() {
  loading.value = true;
  detail.value = null;
  updateResult.value = null;
  try {
    const [detailRes, agentsRes] = await Promise.all([
      api.getSkillDetail(skillName.value),
      api.getAgents(),
    ]);
    detail.value = detailRes;
    agents.value = agentsRes.agents;
    agentOptions.value = agentsRes.agents
      .filter(a => a.installed)
      .map(a => ({ label: a.displayName, value: a.name }));
  } catch (e) {
    message.error(`加载详情失败: ${(e as Error).message}`);
    emit('back');
  } finally {
    loading.value = false;
  }
}

async function doDeploy() {
  deployLoading.value = true;
  try {
    await api.deploySkill(skillName.value, selectedAgents.value);
    message.success(`已分发到 ${selectedAgents.value.join(', ')}`);
    selectedAgents.value = [];
    await loadDetail();
  } catch (e) {
    message.error(`分发失败: ${(e as Error).message}`);
  } finally {
    deployLoading.value = false;
  }
}

async function doUndeploy() {
  undeployLoading.value = true;
  try {
    await api.undeploySkill(skillName.value, selectedAgents.value);
    message.success(`已取消分发 ${selectedAgents.value.join(', ')}`);
    selectedAgents.value = [];
    await loadDetail();
  } catch (e) {
    message.error(`取消分发失败: ${(e as Error).message}`);
  } finally {
    undeployLoading.value = false;
  }
}

async function undeploySingle(agent: string) {
  try {
    await api.undeploySkill(skillName.value, [agent]);
    message.success(`已取消分发 ${agent}`);
    await loadDetail();
  } catch (e) {
    message.error(`取消分发失败: ${(e as Error).message}`);
  }
}

async function addTag() {
  const tag = newTag.value.trim();
  if (!tag) return;
  try {
    const res = await api.manageTag(skillName.value, 'add', tag);
    if (detail.value) {
      detail.value.skill.tags = res.tags;
    }
    newTag.value = '';
    message.success(`已添加标签: ${tag}`);
  } catch (e) {
    message.error(`添加标签失败: ${(e as Error).message}`);
  }
}

async function removeTag(tag: string) {
  try {
    const res = await api.manageTag(skillName.value, 'remove', tag);
    if (detail.value) {
      detail.value.skill.tags = res.tags;
    }
    message.success(`已移除标签: ${tag}`);
  } catch (e) {
    message.error(`移除标签失败: ${(e as Error).message}`);
  }
}

async function checkUpdate() {
  updateLoading.value = true;
  try {
    const res = await api.checkUpdates(skillName.value);
    updateResult.value = res.results[0] ?? null;
  } catch (e) {
    message.error(`检查更新失败: ${(e as Error).message}`);
  } finally {
    updateLoading.value = false;
  }
}

async function removeSkill(scope: 'central' | 'all') {
  try {
    await api.removeSkill(skillName.value, scope);
    message.success(`已删除 ${skillName.value}`);
    emit('removed');
  } catch (e) {
    message.error(`删除失败: ${(e as Error).message}`);
  }
}

watch(() => skillName.value, () => loadDetail());
onMounted(() => loadDetail());
</script>

<style scoped>
.detail-page {
  max-width: 900px;
  margin: 0 auto;
}

.detail-page .detail-header {
  margin: 12px 0 24px;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.skill-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

.skill-desc {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--text-2);
}

.md-preview-container {
  min-height: 300px;
}

.md-preview {
  --md-color: var(--text);
  border-radius: 8px;
}

.backup-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.backup-time {
  color: var(--text-3);
}

.backup-dir {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: var(--accent);
}

.deploy-section,
.tags-section,
.actions-section {
  padding: 8px 0;
}
</style>
