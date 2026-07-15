<template>
  <div class="manage-page">
    <div class="page-title-row">
      <h1 class="page-title">本地 Skill 管理</h1>
      <n-button size="small" quaternary @click="refresh" :loading="loading">刷新</n-button>
    </div>

    <n-spin :show="loading">
      <!-- 分发状态表格 -->
      <n-card size="small" title="分发状态">
        <n-table :bordered="false" :single-line="false" size="small" striped>
          <thead>
            <tr>
              <th>Skill</th>
              <th>版本</th>
              <th v-for="agent in installedAgents" :key="agent">{{ agent }}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="skill in skills" :key="skill.name">
              <td>
                <n-space size="small" align="center">
                  <span class="skill-name-cell" @click="viewDetail(skill.name)">{{ skill.name }}</span>
                  <n-tag v-if="skill.tags.length > 0" size="tiny" round
                    v-for="t in skill.tags.slice(0, 2)" :key="t">{{ t }}</n-tag>
                </n-space>
              </td>
              <td>v{{ skill.version }}</td>
              <td v-for="agent in installedAgents" :key="agent" class="deploy-cell">
                <n-tag
                  size="tiny"
                  :type="skill.agents.includes(agent) ? 'success' : 'default'"
                  round
                >
                  {{ skill.agents.includes(agent) ? '✓ 已分发' : '—' }}
                </n-tag>
              </td>
              <td>
                <n-space size="small">
                  <n-button
                    size="tiny"
                    type="primary"
                    ghost
                    @click="openDeployDialog(skill)"
                  >
                    分发
                  </n-button>
                  <n-button
                    size="tiny"
                    type="warning"
                    ghost
                    @click="openUndeployDialog(skill)"
                  >
                    取消
                  </n-button>
                </n-space>
              </td>
            </tr>
          </tbody>
        </n-table>
        <n-empty v-if="!loading && skills.length === 0" description="暂无 skill" />
      </n-card>

      <n-divider />

      <!-- 标签管理 -->
      <n-card size="small" title="标签管理">
        <n-space align="center" style="margin-bottom: 12px">
          <n-select
            v-model:value="tagFilter"
            :options="tagOptions"
            placeholder="按标签筛选..."
            clearable
            size="small"
            style="width: 200px"
          />
          <n-input
            v-model:value="newTagName"
            placeholder="新建标签..."
            size="small"
            style="width: 160px"
            @keyup.enter="createTagForSelected"
          />
          <n-select
            v-model:value="tagTargetSkill"
            :options="skillOptions"
            placeholder="选择 skill..."
            clearable
            size="small"
            style="width: 200px"
          />
          <n-button
            size="small"
            type="primary"
            :disabled="!newTagName.trim() || !tagTargetSkill"
            @click="addTagToSkill"
          >
            添加
          </n-button>
        </n-space>

        <n-space v-if="Object.keys(allTags).length > 0" vertical>
          <div v-for="(skills, tag) in allTags" :key="tag" class="tag-row">
            <n-tag size="small" type="info" round>{{ tag }}</n-tag>
            <span class="tag-count">({{ skills.length }})</span>
            <n-space size="small" style="margin-left: 8px">
              <n-tag
                v-for="s in skills"
                :key="s"
                size="tiny"
                closable
                @close="removeTagFromSkill(s, tag)"
              >
                {{ s }}
              </n-tag>
            </n-space>
          </div>
        </n-space>
        <n-empty v-else description="暂无标签" />
      </n-card>
    </n-spin>

    <!-- 分发对话框 -->
    <n-modal v-model:show="deployVisible" preset="dialog" :title="deployTitle">
      <n-space vertical>
        <p>选择要分发的 Agent：</p>
        <n-select
          v-model:value="deploySelectedAgents"
          :options="agentOptions"
          multiple
          placeholder="选择 Agent..."
        />
      </n-space>
      <template #action>
        <n-space>
          <n-button @click="deployVisible = false">取消</n-button>
          <n-button
            type="primary"
            :loading="deployLoading"
            :disabled="deploySelectedAgents.length === 0"
            @click="confirmDeploy"
          >
            确认分发
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 取消分对话框 -->
    <n-modal v-model:show="undeployVisible" preset="dialog" :title="undeployTitle">
      <n-space vertical>
        <p>选择要取消分发的 Agent：</p>
        <n-select
          v-model:value="undeploySelectedAgents"
          :options="undeployAgentOptions"
          multiple
          placeholder="选择 Agent..."
        />
      </n-space>
      <template #action>
        <n-space>
          <n-button @click="undeployVisible = false">取消</n-button>
          <n-button
            type="warning"
            :loading="undeployLoading"
            :disabled="undeploySelectedAgents.length === 0"
            @click="confirmUndeploy"
          >
            确认取消
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMessage } from 'naive-ui';
import { useRouter } from 'vue-router';
import { api, type SkillInfo, type AgentInfo } from '../api';

const message = useMessage();
const router = useRouter();

const loading = ref(false);
const skills = ref<SkillInfo[]>([]);
const agents = ref<AgentInfo[]>([]);
const allTags = ref<Record<string, string[]>>({});
const tagFilter = ref<string | null>(null);
const newTagName = ref('');
const tagTargetSkill = ref<string | null>(null);

// Deploy dialog
const deployVisible = ref(false);
const deployTitle = ref('');
const deploySelectedAgents = ref<string[]>([]);
const deployLoading = ref(false);
const deployTargetSkill = ref('');

// Undeploy dialog
const undeployVisible = ref(false);
const undeployTitle = ref('');
const undeploySelectedAgents = ref<string[]>([]);
const undeployLoading = ref(false);
const undeployTargetSkill = ref('');

const installedAgents = computed(() =>
  agents.value.filter(a => a.installed).map(a => a.name)
);

const agentOptions = computed(() =>
  agents.value.filter(a => a.installed).map(a => ({ label: a.displayName, value: a.name }))
);

const skillOptions = computed(() =>
  skills.value.map(s => ({ label: s.name, value: s.name }))
);

const tagOptions = computed(() => {
  const tags = Object.keys(allTags.value);
  return tags.map(tag => ({ label: tag, value: tag }));
});

const undeployAgentOptions = computed(() => {
  const skill = skills.value.find(s => s.name === undeployTargetSkill.value);
  if (!skill) return [];
  return agentOptions.value.filter(opt => skill.agents.includes(opt.value));
});

async function refresh() {
  loading.value = true;
  try {
    const [skillsRes, agentsRes, tagsRes] = await Promise.all([
      api.getSkills(),
      api.getAgents(),
      api.getTags(),
    ]);
    skills.value = skillsRes.skills;
    agents.value = agentsRes.agents;
    allTags.value = tagsRes.tags;
  } catch (e) {
    message.error(`加载失败: ${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
}

function viewDetail(name: string) {
  router.push({ name: 'skillDetail', params: { name } });
}

function openDeployDialog(skill: SkillInfo) {
  deployTargetSkill.value = skill.name;
  deployTitle.value = `分发 ${skill.name}`;
  deploySelectedAgents.value = [];
  deployVisible.value = true;
}

function openUndeployDialog(skill: SkillInfo) {
  if (skill.agents.length === 0) {
    message.info('该 skill 未分发到任何 Agent');
    return;
  }
  undeployTargetSkill.value = skill.name;
  undeployTitle.value = `取消分发 ${skill.name}`;
  undeploySelectedAgents.value = [];
  undeployVisible.value = true;
}

async function confirmDeploy() {
  deployLoading.value = true;
  try {
    await api.deploySkill(deployTargetSkill.value, deploySelectedAgents.value);
    message.success(`已分发到 ${deploySelectedAgents.value.join(', ')}`);
    deployVisible.value = false;
    await refresh();
  } catch (e) {
    message.error(`分发失败: ${(e as Error).message}`);
  } finally {
    deployLoading.value = false;
  }
}

async function confirmUndeploy() {
  undeployLoading.value = true;
  try {
    await api.undeploySkill(undeployTargetSkill.value, undeploySelectedAgents.value);
    message.success(`已取消分发 ${undeploySelectedAgents.value.join(', ')}`);
    undeployVisible.value = false;
    await refresh();
  } catch (e) {
    message.error(`取消分发失败: ${(e as Error).message}`);
  } finally {
    undeployLoading.value = false;
  }
}

async function addTagToSkill() {
  const tag = newTagName.value.trim();
  const skill = tagTargetSkill.value;
  if (!tag || !skill) return;
  try {
    await api.manageTag(skill, 'add', tag);
    message.success(`已添加标签 "${tag}" 到 ${skill}`);
    newTagName.value = '';
    await refresh();
  } catch (e) {
    message.error(`添加标签失败: ${(e as Error).message}`);
  }
}

function createTagForSelected() {
  const tag = newTagName.value.trim();
  if (!tag) return;
  
  // 如果没有选择 skill，尝试选择第一个可用的 skill
  if (!tagTargetSkill.value && skillOptions.value.length > 0) {
    tagTargetSkill.value = skillOptions.value[0].value;
  }
  
  // 如果有选择的 skill，直接添加标签
  if (tagTargetSkill.value) {
    addTagToSkill();
  } else {
    message.warning('请先选择一个 skill');
  }
}

async function removeTagFromSkill(skill: string, tag: string) {
  try {
    await api.manageTag(skill, 'remove', tag);
    message.success(`已从 ${skill} 移除标签 "${tag}"`);
    await refresh();
  } catch (e) {
    message.error(`移除标签失败: ${(e as Error).message}`);
  }
}

onMounted(() => refresh());
</script>

<style scoped>
.manage-page {
  max-width: 1100px;
  margin: 0 auto;
}

.skill-name-cell {
  cursor: pointer;
  color: var(--accent);
  font-weight: 500;
}

.skill-name-cell:hover {
  text-decoration: underline;
}

.deploy-cell {
  text-align: center;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
}

.tag-count {
  font-size: 12px;
  color: var(--text-3);
}
</style>
