<template>
  <div class="conflicts-page">
    <div class="page-header">
      <h3>冲突检测</h3>
      <n-space>
        <n-tag v-if="conflicts.length > 0" type="error" size="small" round>
          {{ conflicts.length }} 个冲突
        </n-tag>
        <n-tag v-else-if="!loading && hasChecked" type="success" size="small" round>
          无冲突
        </n-tag>
        <n-button size="small" @click="refresh" :loading="loading">检测冲突</n-button>
      </n-space>
    </div>

    <n-spin :show="loading">
      <n-empty
        v-if="!loading && conflicts.length === 0 && hasChecked"
        description="未检测到冲突，所有分发状态正常"
        class="empty-state"
      />

      <n-empty
        v-if="!loading && !hasChecked"
        description="点击「检测冲突」开始扫描"
        class="empty-state"
      />

      <div v-if="conflicts.length > 0" class="conflict-list">
        <n-card
          v-for="(conflict, idx) in conflicts"
          :key="idx"
          size="small"
          class="conflict-card"
          :bordered="true"
        >
          <template #header>
            <div class="conflict-header">
              <n-space size="small" align="center">
                <n-tag
                  :type="conflictTypeColor(conflict.type)"
                  size="small"
                  round
                >
                  {{ conflictTypeLabel(conflict.type) }}
                </n-tag>
                <span class="conflict-skill">{{ conflict.skillName }}</span>
                <span class="conflict-agent">→ {{ conflict.agent }}</span>
              </n-space>
            </div>
          </template>

          <div class="conflict-body">
            <p class="conflict-detail">{{ conflict.detail }}</p>
            <code class="conflict-path">{{ conflict.destPath }}</code>
          </div>

          <template #action>
            <n-space>
              <n-button
                size="tiny"
                type="primary"
                @click="resolveForceDeploy(conflict)"
              >
                强制重新分发
              </n-button>
              <n-button
                size="tiny"
                type="warning"
                @click="resolveUndeploy(conflict)"
              >
                移除冲突文件
              </n-button>
            </n-space>
          </template>
        </n-card>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMessage } from 'naive-ui';
import { api, type ConflictInfo } from '../api';

const message = useMessage();
const loading = ref(false);
const hasChecked = ref(false);
const conflicts = ref<ConflictInfo[]>([]);

function conflictTypeLabel(type: ConflictInfo['type']): string {
  switch (type) {
    case 'managed-mismatch': return '管理不一致';
    case 'unmanaged': return '未管理副本';
    case 'broken-symlink': return '失效链接';
    default: return type;
  }
}

function conflictTypeColor(type: ConflictInfo['type']): 'error' | 'warning' | 'info' {
  switch (type) {
    case 'managed-mismatch': return 'error';
    case 'unmanaged': return 'warning';
    case 'broken-symlink': return 'info';
    default: return 'info';
  }
}

async function refresh() {
  loading.value = true;
  try {
    const res = await api.getConflicts();
    conflicts.value = res.conflicts;
    hasChecked.value = true;
    if (res.conflicts.length === 0) {
      message.success('未检测到冲突');
    } else {
      message.warning(`检测到 ${res.conflicts.length} 个冲突`);
    }
  } catch (e) {
    message.error(`检测失败: ${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
}

async function resolveForceDeploy(conflict: ConflictInfo) {
  try {
    await api.deploySkill(conflict.skillName, [conflict.agent]);
    message.success(`已强制重新分发 ${conflict.skillName} → ${conflict.agent}`);
    await refresh();
  } catch (e) {
    message.error(`解决失败: ${(e as Error).message}`);
  }
}

async function resolveUndeploy(conflict: ConflictInfo) {
  try {
    await api.undeploySkill(conflict.skillName, [conflict.agent]);
    message.success(`已移除 ${conflict.agent} 中的冲突文件`);
    await refresh();
  } catch (e) {
    message.error(`解决失败: ${(e as Error).message}`);
  }
}
</script>

<style scoped>
.conflicts-page {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-header h3 {
  margin: 0;
  font-size: 16px;
}

.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.conflict-header {
  display: flex;
  align-items: center;
}

.conflict-skill {
  font-weight: 600;
  font-size: 14px;
}

.conflict-agent {
  font-size: 13px;
  color: var(--text-color-3, #999);
}

.conflict-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conflict-detail {
  margin: 0;
  font-size: 13px;
}

.conflict-path {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: var(--primary-color, #63e2b7);
  word-break: break-all;
}

.empty-state {
  padding: 60px 0;
}
</style>
