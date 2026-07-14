<template>
  <div class="search-page">
    <n-input
      v-model:value="query"
      placeholder="搜索 skill（本地 + skills.sh）..."
      size="large"
      clearable
      @keyup.enter="doSearch"
    >
      <template #append>
        <n-button @click="doSearch" :loading="loading" type="primary">
          搜索
        </n-button>
      </template>
    </n-input>

    <n-space class="scope-tabs" align="center">
      <n-button
        :type="scope === 'all' ? 'primary' : 'default'"
        size="small"
        @click="scope = 'all'; doSearch()"
      >
        全部
      </n-button>
      <n-button
        :type="scope === 'local' ? 'primary' : 'default'"
        size="small"
        @click="scope = 'local'; doSearch()"
      >
        仅本地
      </n-button>
      <n-button
        :type="scope === 'remote' ? 'primary' : 'default'"
        size="small"
        @click="scope = 'remote'; doSearch()"
      >
        仅 skills.sh
      </n-button>
    </n-space>

    <n-spin :show="loading">
      <n-empty v-if="!loading && hasSearched && localResults.length === 0 && remoteResults.length === 0"
        description="无搜索结果"
        class="empty-state"
      />

      <div v-if="localResults.length > 0" class="result-section">
        <h3 class="section-title">本地搜索结果 ({{ localResults.length }})</h3>
        <div class="result-cards">
          <n-card
            v-for="item in localResults"
            :key="item.skillId"
            size="small"
            class="result-card"
            hoverable
          >
            <template #header>
              <div class="result-header">
                <span class="result-name">{{ item.name }}</span>
                <n-tag v-if="item.localVersion" size="tiny" type="info">
                  v{{ item.localVersion }}
                </n-tag>
              </div>
            </template>
            <p class="result-desc">{{ item.description || '无描述' }}</p>
          </n-card>
        </div>
      </div>

      <div v-if="remoteResults.length > 0" class="result-section">
        <h3 class="section-title">skills.sh 搜索结果 ({{ remoteResults.length }})</h3>
        <div class="result-cards">
          <n-card
            v-for="item in remoteResults"
            :key="item.skillId"
            size="small"
            class="result-card"
            hoverable
          >
            <template #header>
              <div class="result-header">
                <span class="result-name">{{ item.name }}</span>
                <n-space size="small">
                  <n-tag v-if="item.stars !== undefined" size="tiny" type="warning">
                    ★ {{ item.stars }}
                  </n-tag>
                  <n-tag v-if="item.installs !== undefined" size="tiny">
                    ↓ {{ item.installs }}
                  </n-tag>
                </n-space>
              </div>
            </template>
            <p class="result-source">{{ item.source }}/{{ item.skillId }}</p>
            <p class="result-desc">{{ item.description || '无描述' }}</p>
            <n-button
              size="tiny"
              type="primary"
              ghost
              @click="installFromSearch(item)"
            >
              安装
            </n-button>
          </n-card>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMessage } from 'naive-ui';
import { api, type SearchResult } from '../api';

const message = useMessage();

const query = ref('');
const scope = ref<'all' | 'local' | 'remote'>('all');
const loading = ref(false);
const hasSearched = ref(false);
const localResults = ref<SearchResult[]>([]);
const remoteResults = ref<SearchResult[]>([]);

async function doSearch() {
  if (!query.value.trim()) {
    localResults.value = [];
    remoteResults.value = [];
    hasSearched.value = false;
    return;
  }

  loading.value = true;
  hasSearched.value = true;

  try {
    const result = await api.search(query.value, scope.value);
    localResults.value = result.local;
    remoteResults.value = result.remote;
  } catch (e) {
    message.error(`搜索失败: ${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
}

async function installFromSearch(item: SearchResult) {
  try {
    message.loading('正在安装...', { duration: 0 });
    await api.installSkill({
      source: `${item.source}/${item.skillId}`,
    });
    message.success(`已安装 ${item.name}`);
  } catch (e) {
    message.error(`安装失败: ${(e as Error).message}`);
  }
}
</script>

<style scoped>
.search-page {
  max-width: 900px;
  margin: 0 auto;
}

.scope-tabs {
  margin: 16px 0;
}

.result-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  color: #6e6e73;
  margin-bottom: 12px;
  font-weight: 600;
}

.result-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}

.result-card {
  cursor: pointer;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-name {
  font-weight: 600;
  font-size: 14px;
}

.result-source {
  margin: 0;
  font-size: 12px;
  color: #86868b;
  font-family: 'SF Mono', Monaco, monospace;
}

.result-desc {
  margin: 4px 0 8px;
  font-size: 13px;
  color: #6e6e73;
}

.empty-state {
  padding: 60px 0;
}
</style>
