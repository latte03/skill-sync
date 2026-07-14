<template>
  <div class="skills-page">
    <!-- 统计卡片 -->
    <n-grid :cols="4" :x-gap="16" :y-gap="16" class="stats-grid">
      <n-grid-item>
        <n-card size="small">
          <n-statistic label="总 Skills" :value="status?.skillCount ?? 0" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card size="small">
          <n-statistic label="已管理" :value="status?.managedCount ?? 0" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card size="small">
          <n-statistic label="未管理" :value="status?.unmanagedCount ?? 0" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card size="small">
          <n-statistic label="已安装 Agent" :value="status?.installedAgents?.length ?? 0" />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-divider />

    <!-- 过滤栏 -->
    <n-space class="filter-bar" justify="space-between" align="center">
      <n-space align="center">
        <n-input
          v-model:value="filterText"
          placeholder="过滤 skill..."
          clearable
          size="small"
          style="width: 240px"
        />
        <n-select
          v-model:value="filterAgent"
          :options="agentOptions"
          placeholder="按 Agent"
          clearable
          size="small"
          style="width: 160px"
        />
        <n-select
          v-model:value="filterTag"
          :options="tagOptions"
          placeholder="按标签"
          clearable
          size="small"
          style="width: 160px"
        />
      </n-space>
      <n-button size="small" @click="refresh" :loading="loading">
        刷新
      </n-button>
    </n-space>

    <!-- Skill 列表 -->
    <n-spin :show="loading">
      <n-empty v-if="!loading && filteredSkills.length === 0" description="暂无 skill" class="empty-state" />

      <div v-else class="skill-cards">
        <n-card
          v-for="skill in filteredSkills"
          :key="skill.name"
          size="small"
          class="skill-card"
          :bordered="true"
          hoverable
          @click="$emit('viewDetail', skill.name)"
        >
          <template #header>
            <div class="card-header">
              <span class="skill-name">{{ skill.name }}</span>
              <n-tag size="tiny" :type="skill.managed ? 'success' : 'warning'" round>
                {{ skill.managed ? 'managed' : 'unmanaged' }}
              </n-tag>
            </div>
          </template>

          <div class="card-body">
            <p class="skill-desc">{{ skill.description || '无描述' }}</p>
            <n-space size="small" align="center">
              <n-tag size="tiny" type="info">v{{ skill.version }}</n-tag>
              <n-tag
                v-for="tag in skill.tags"
                :key="tag"
                size="tiny"
                round
              >
                {{ tag }}
              </n-tag>
            </n-space>
            <div class="skill-agents">
              <span v-if="skill.agents.length > 0" class="agents-label">
                分发: {{ skill.agents.join(', ') }}
              </span>
              <span v-else class="agents-label agents-none">未分发</span>
            </div>
          </div>
        </n-card>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMessage } from 'naive-ui';
import { api, type SkillInfo, type StatusInfo } from '../api';

defineEmits<{ viewDetail: [name: string] }>();

const message = useMessage();

const loading = ref(false);
const skills = ref<SkillInfo[]>([]);
const status = ref<StatusInfo | null>(null);
const filterText = ref('');
const filterAgent = ref<string | null>(null);
const filterTag = ref<string | null>(null);
const agentOptions = ref<{ label: string; value: string }[]>([]);
const tagOptions = ref<{ label: string; value: string }[]>([]);

const filteredSkills = computed(() => {
  let result = skills.value;

  if (filterText.value) {
    const q = filterText.value.toLowerCase();
    result = result.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  }

  if (filterAgent.value) {
    result = result.filter(s => s.agents.includes(filterAgent.value!));
  }

  return result;
});

async function refresh() {
  loading.value = true;
  try {
    const [statusRes, skillsRes, agentsRes, tagsRes] = await Promise.all([
      api.getStatus(),
      api.getSkills(),
      api.getAgents(),
      api.getTags(),
    ]);

    status.value = statusRes;
    skills.value = skillsRes.skills;
    agentOptions.value = agentsRes.agents
      .filter(a => a.installed)
      .map(a => ({ label: a.displayName, value: a.name }));

    tagOptions.value = Object.keys(tagsRes.tags).map(t => ({ label: t, value: t }));
  } catch (e) {
    message.error(`加载失败: ${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  refresh();
});
</script>

<style scoped>
.skills-page {
  max-width: 1200px;
  margin: 0 auto;
}

.stats-grid {
  margin-bottom: 8px;
}

.filter-bar {
  margin-bottom: 16px;
}

.skill-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}

.skill-card {
  cursor: pointer;
  transition: transform 0.1s;
}

.skill-card:hover {
  transform: translateY(-1px);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.skill-name {
  font-weight: 600;
  font-size: 14px;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-color-3, #999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-agents {
  font-size: 12px;
  color: var(--text-color-3, #999);
}

.agents-none {
  color: var(--warning-color, #f0a020);
}

.empty-state {
  padding: 60px 0;
}
</style>
