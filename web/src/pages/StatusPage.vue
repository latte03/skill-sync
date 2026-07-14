<template>
  <div class="status-page">
    <n-spin :show="loading">
      <div v-if="status" class="status-content">
        <!-- 概览卡片 -->
        <n-grid :cols="3" :x-gap="16" :y-gap="16">
          <n-grid-item>
            <n-card size="small">
              <n-statistic label="中央仓库" :value="status.skillCount">
                <template #suffix>skills</template>
              </n-statistic>
            </n-card>
          </n-grid-item>
          <n-grid-item>
            <n-card size="small">
              <n-statistic label="已管理" :value="status.managedCount">
                <template #suffix>/ {{ status.skillCount }}</template>
              </n-statistic>
            </n-card>
          </n-grid-item>
          <n-grid-item>
            <n-card size="small">
              <n-statistic label="已安装 Agent" :value="status.installedAgents.length" />
            </n-card>
          </n-grid-item>
        </n-grid>

        <n-divider />

        <!-- Agent 分发统计 -->
        <h3>Agent 分发统计</h3>
        <n-table :bordered="false" :single-line="false" size="small">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Managed</th>
              <th>Unmanaged</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="agent in status.agents" :key="agent.agent">
              <td>{{ agent.agent }}</td>
              <td>{{ agent.managed }}</td>
              <td>{{ agent.unmanaged }}</td>
              <td>{{ agent.total }}</td>
            </tr>
          </tbody>
        </n-table>

        <n-divider />

        <!-- 中央仓库路径 -->
        <n-card size="small" title="中央仓库">
          <code class="path-text">{{ status.homeDir }}</code>
        </n-card>

        <n-divider />

        <!-- 更新检查 -->
        <h3>更新检查</h3>
        <n-button @click="checkUpdates" :loading="updateLoading" size="small">
          检查更新
        </n-button>

        <div v-if="updateResults.length > 0" class="update-list">
          <div v-for="item in updateResults" :key="item.name" class="update-item">
            <span class="update-name">{{ item.name }}</span>
            <n-tag v-if="item.isLocal" size="tiny" type="default">本地</n-tag>
            <n-tag v-else-if="item.hasUpdate" size="tiny" type="warning">
              {{ item.currentVersion }} → {{ item.remoteVersion }}
            </n-tag>
            <n-tag v-else size="tiny" type="success">
              v{{ item.currentVersion }} (最新)
            </n-tag>
          </div>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMessage } from 'naive-ui';
import { api, type StatusInfo, type UpdateCheckResult } from '../api';

const message = useMessage();
const loading = ref(false);
const status = ref<StatusInfo | null>(null);
const updateLoading = ref(false);
const updateResults = ref<UpdateCheckResult[]>([]);

async function refresh() {
  loading.value = true;
  try {
    status.value = await api.getStatus();
  } catch (e) {
    message.error(`加载状态失败: ${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
}

async function checkUpdates() {
  updateLoading.value = true;
  try {
    const result = await api.checkUpdates();
    updateResults.value = result.results;
    const updates = result.results.filter(r => r.hasUpdate);
    if (updates.length > 0) {
      message.info(`${updates.length} 个 skill 有更新可用`);
    } else {
      message.success('所有 skill 均为最新版本');
    }
  } catch (e) {
    message.error(`检查更新失败: ${(e as Error).message}`);
  } finally {
    updateLoading.value = false;
  }
}

onMounted(() => {
  refresh();
});
</script>

<style scoped>
.status-page {
  max-width: 860px;
  margin: 0 auto;
}

.path-text {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
  color: #007aff;
}

.update-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.update-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.update-name {
  min-width: 200px;
  font-weight: 500;
  color: #1d1d1f;
}
</style>
