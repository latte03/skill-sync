<template>
  <div class="skills-page">
    <!-- ─── Page Header ─── -->
    <div class="page-title-row">
      <div>
        <h1 class="page-title">Skills</h1>
        <p class="page-subtitle">中央仓库中的全部 skill</p>
      </div>
      <n-button size="small" quaternary @click="refresh" :loading="loading">
        <template #icon>
          <n-icon><RefreshOutline /></n-icon>
        </template>
        刷新
      </n-button>
    </div>

    <!-- ─── Stats Strip ─── -->
    <div class="stats-grid">
      <div v-for="stat in statCards" :key="stat.label" class="stat-card">
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
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
      <div class="filter-meta">
        {{ filteredSkills.length }} 项
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
        <article
          v-for="skill in filteredSkills"
          :key="skill.name"
          class="skill-card"
          :class="{ managed: skill.managed }"
          @click="viewDetail(skill.name)"
        >
          <!-- 头部：monogram + 名称 + 状态 -->
          <header class="card-head">
            <div class="monogram" :class="skill.managed ? 'mono--managed' : 'mono--unmanaged'">
              {{ skill.name.split('/').at(-1)?.slice(0, 2).toUpperCase() }}
            </div>

            <div class="title-block">
              <h3 class="skill-name" :title="skill.name">{{ skill.name }}</h3>
              <div class="metadata-row">
                <span class="version-badge">v{{ skill.version }}</span>
              </div>
            </div>

            <span
              class="status-pill"
              :class="skill.managed ? 'pill-managed' : 'pill-unmanaged'"
            >
              {{ skill.managed ? 'managed' : 'unmanaged' }}
            </span>
          </header>

          <!-- 描述：最多 2 行 -->
          <p class="skill-desc" :title="skill.description || '无描述'">
            {{ skill.description || '无描述' }}
          </p>

          <!-- 底部：标签 + agent 分发 -->
          <footer class="card-foot">
            <div class="tag-row">
              <template v-if="skill.tags.length > 0">
                <span v-for="tag in skill.tags.slice(0, 3)" :key="tag" class="tag-chip">
                  {{ tag }}
                </span>
                <span v-if="skill.tags.length > 3" class="tag-chip tag-more">
                  +{{ skill.tags.length - 3 }}
                </span>
              </template>
              <span v-else class="tag-empty">无标签</span>
            </div>

            <div class="agents-row">
              <template v-if="skill.agents.length > 0">
                <span
                  v-for="agent in skill.agents.slice(0, 4)"
                  :key="agent"
                  class="agent-chip"
                  :title="agent"
                >
                  {{ shortAgent(agent) }}
                </span>
                <span v-if="skill.agents.length > 4" class="agent-more">
                  +{{ skill.agents.length - 4 }}
                </span>
              </template>
              <span v-else class="agents-none">未分发</span>
            </div>
          </footer>
        </article>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { RefreshOutline } from '@vicons/ionicons5';
import { api, type SkillInfo, type StatusInfo } from '../api';

const router = useRouter();
const message = useMessage();

const loading = ref(false);
const skills = ref<SkillInfo[]>([]);
const status = ref<StatusInfo | null>(null);
const filterText = ref('');
const filterAgent = ref<string | null>(null);
const filterTag = ref<string | null>(null);
const agentOptions = ref<{ label: string; value: string }[]>([]);
const tagOptions = ref<{ label: string; value: string }[]>([]);

const statCards = computed(() => [
  { label: '总数', value: status.value?.skillCount ?? 0 },
  { label: '已管理', value: status.value?.managedCount ?? 0 },
  { label: '未管理', value: status.value?.unmanagedCount ?? 0 },
  { label: '已安装 Agent', value: status.value?.installedAgents?.length ?? 0 },
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

function shortAgent(name: string): string {
  // claude-code -> cl, opencode -> op, cursor -> cu
  const parts = name.replace(/[-_]/g, '-').split('-');
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts.slice(0, 2).map(p => p[0]).join('');
}

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

function viewDetail(name: string) {
  router.push({ name: 'skillDetail', params: { name } });
}

onMounted(() => refresh());
</script>

<style scoped>
.skills-page {
  max-width: 1040px;
  margin: 0 auto;
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-3);
}

/* ─── Stats Strip ───────────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 500;
  margin-top: 2px;
}

/* ─── Filter Bar ───────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.filter-meta {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

/* ─── Skill Cards ───────────────────────────────────────────────── */
.skill-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}

.skill-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px 14px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
  overflow: hidden;
}

.skill-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--warning);
  opacity: 0.7;
  transition: opacity 0.16s ease, background 0.16s ease;
}

.skill-card.managed::before {
  background: var(--success);
  opacity: 1;
}

.skill-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--accent-border);
}

.skill-card:hover::before {
  opacity: 1;
}

/* ─── Card Head: monogram + 名称 ──────────────────────────────── */
.card-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.monogram {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  font-family: 'SF Mono', Monaco, ui-monospace, monospace;
  background: var(--surface-hover);
  color: var(--text-2);
  border: 1px solid var(--border);
}

.mono--managed {
  background: color-mix(in srgb, var(--success) 12%, var(--surface));
  color: color-mix(in srgb, var(--success) 75%, var(--text));
  border-color: color-mix(in srgb, var(--success) 25%, var(--border));
}

.mono--unmanaged {
  background: color-mix(in srgb, var(--warning) 10%, var(--surface));
  color: color-mix(in srgb, var(--warning) 70%, var(--text));
  border-color: color-mix(in srgb, var(--warning) 22%, var(--border));
}

.title-block {
  flex: 1;
  min-width: 0;
}

.skill-name {
  margin: 1px 0 3px;
  font-size: 15.5px;
  font-weight: 650;
  color: var(--text);
  letter-spacing: -0.012em;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadata-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
}

.version-badge {
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}

.status-pill {
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.02em;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
}

.pill-managed {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: color-mix(in srgb, var(--success) 75%, #000);
}

.pill-unmanaged {
  background: color-mix(in srgb, var(--warning) 14%, transparent);
  color: color-mix(in srgb, var(--warning) 70%, #000);
}

/* ─── 描述：2 行 clamp ────────────────────────────────────────── */
.skill-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.6em;
}

/* ─── 卡片底部：标签 + agents ─────────────────────────────────── */
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  flex-wrap: wrap;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  min-width: 0;
}

.tag-chip {
  font-size: 10.5px;
  color: var(--text-2);
  background: var(--surface-2);
  border: 1px solid var(--border);
  padding: 1px 7px;
  border-radius: 4px;
}

.tag-more {
  color: var(--text-3);
  border-style: dashed;
}

.tag-empty {
  font-size: 11px;
  color: var(--text-3);
  opacity: 0.6;
}

.agents-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.agent-chip {
  font-family: 'SF Mono', Monaco, ui-monospace, monospace;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-2);
  background: var(--surface-2);
  border: 1px solid var(--border);
  padding: 2px 5px;
  border-radius: 4px;
  min-width: 22px;
  text-align: center;
}

.agent-more {
  font-size: 11px;
  color: var(--text-3);
  padding-left: 2px;
}

.agents-none {
  font-size: 11px;
  color: var(--warning);
}

.empty-state {
  padding: 80px 0;
}

/* ─── Dark mode color adjust for pills/monogram ────────────────── */
[data-theme='dark'] .pill-managed {
  color: color-mix(in srgb, var(--success) 88%, #fff);
}
[data-theme='dark'] .pill-unmanaged {
  color: color-mix(in srgb, var(--warning) 88%, #fff);
}
[data-theme='dark'] .mono--managed {
  color: color-mix(in srgb, var(--success) 88%, #fff);
}
[data-theme='dark'] .mono--unmanaged {
  color: color-mix(in srgb, var(--warning) 88%, #fff);
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .skill-cards {
    grid-template-columns: 1fr;
  }
}
</style>
