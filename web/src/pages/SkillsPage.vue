<template>
  <div class="skills-page">
    <!-- ─── Stats Cards ─── -->
    <div class="stats-grid">
      <div
        v-for="stat in statCards"
        :key="stat.label"
        class="stat-card"
        :style="{ '--accent': stat.color }"
      >
        <div class="stat-icon-wrap">
          <n-icon size="20" :color="stat.color">
            <component :is="stat.icon" />
          </n-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </div>

    <!-- ─── Filter Bar ─── -->
    <div class="filter-bar">
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
      <div class="filter-bar-right">
        <n-button size="small" quaternary @click="refresh" :loading="loading">
          刷新
        </n-button>
      </div>
    </div>

    <!-- ─── Skill Cards ─── -->
    <n-spin :show="loading">
      <n-empty
        v-if="!loading && filteredSkills.length === 0"
        description="暂无 skill"
        class="empty-state"
      />

      <div v-else class="skill-cards">
        <div
          v-for="skill in filteredSkills"
          :key="skill.name"
          class="skill-card"
          :class="{ managed: skill.managed }"
          @click="$emit('viewDetail', skill.name)"
        >
          <div class="card-header">
            <span class="skill-name">{{ skill.name }}</span>
            <span
              class="status-pill"
              :class="skill.managed ? 'pill-managed' : 'pill-unmanaged'"
            >
              {{ skill.managed ? 'managed' : 'unmanaged' }}
            </span>
          </div>

          <p class="skill-desc">{{ skill.description || '无描述' }}</p>

          <div class="card-footer">
            <div class="tag-row">
              <span class="version-badge">v{{ skill.version }}</span>
              <span
                v-for="tag in skill.tags"
                :key="tag"
                class="tag-chip"
              >
                {{ tag }}
              </span>
            </div>
            <div class="agents-line">
              <span v-if="skill.agents.length > 0" class="agents-text">
                {{ skill.agents.join(' · ') }}
              </span>
              <span v-else class="agents-none">未分发</span>
            </div>
          </div>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw } from 'vue';
import { useMessage } from 'naive-ui';
import { CubeOutline, CheckmarkCircleOutline, AlertCircleOutline, TerminalOutline } from '@vicons/ionicons5';
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

// ─── Stat cards (computed for reactivity) ───────────────────────
const statCards = computed(() => [
  { label: '总 Skills', value: status.value?.skillCount ?? 0, color: '#007AFF', icon: markRaw(CubeOutline) },
  { label: '已管理', value: status.value?.managedCount ?? 0, color: '#34C759', icon: markRaw(CheckmarkCircleOutline) },
  { label: '未管理', value: status.value?.unmanagedCount ?? 0, color: '#FF9500', icon: markRaw(AlertCircleOutline) },
  { label: '已安装 Agent', value: status.value?.installedAgents?.length ?? 0, color: '#AF52DE', icon: markRaw(TerminalOutline) },
]);

const filteredSkills = computed(() => {
  let result = skills.value;

  if (filterText.value) {
    const q = filterText.value.toLowerCase();
    result = result.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }

  if (filterAgent.value) {
    result = result.filter(s => s.agents.includes(filterAgent.value!));
  }

  if (filterTag.value) {
    result = result.filter(s => s.tags.includes(filterTag.value!));
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
  max-width: 1000px;
  margin: 0 auto;
}

/* ─── Stats Grid ────────────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.60);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.stat-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  flex-shrink: 0;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1d1d1f;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 12px;
  color: #86868b;
  font-weight: 500;
}

/* ─── Filter Bar ────────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-bar-right {
  margin-left: auto;
}

/* ─── Skill Cards ───────────────────────────────────────────────── */
.skill-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.skill-card {
  padding: 18px 20px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.skill-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.07);
  border-color: rgba(0, 122, 255, 0.20);
}

.skill-card.managed {
  border-left: 3px solid #34c759;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.skill-name {
  font-weight: 600;
  font-size: 15px;
  color: #1d1d1f;
  letter-spacing: -0.01em;
}

.status-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 8px;
  letter-spacing: 0.02em;
}

.pill-managed {
  background: rgba(52, 199, 89, 0.12);
  color: #248a3d;
}

.pill-unmanaged {
  background: rgba(255, 149, 0, 0.12);
  color: #c26e00;
}

.skill-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #6e6e73;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.version-badge {
  font-size: 11px;
  font-weight: 600;
  color: #007aff;
  background: rgba(0, 122, 255, 0.08);
  padding: 2px 8px;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}

.tag-chip {
  font-size: 11px;
  color: #6e6e73;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: 6px;
}

.agents-line {
  font-size: 12px;
  color: #86868b;
}

.agents-text {
  color: #6e6e73;
}

.agents-none {
  color: #c26e00;
}

.empty-state {
  padding: 80px 0;
}

/* ─── Responsive ────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
