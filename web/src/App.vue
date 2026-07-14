<template>
  <n-config-provider :theme="darkTheme" :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-dialog-provider>
        <n-layout class="app-layout" position="absolute">
          <n-layout-header bordered class="app-header">
            <div class="header-content">
              <div class="logo">
                <span class="logo-icon">⚡</span>
                <span class="logo-text">SkillSync</span>
              </div>
              <n-space>
                <n-button quaternary size="small"
                  :type="activeTab === 'skills' ? 'primary' : 'default'"
                  @click="activeTab = 'skills'"
                >
                  Skills
                </n-button>
                <n-button quaternary size="small"
                  :type="activeTab === 'search' ? 'primary' : 'default'"
                  @click="activeTab = 'search'"
                >
                  搜索
                </n-button>
                <n-button quaternary size="small"
                  :type="activeTab === 'manage' ? 'primary' : 'default'"
                  @click="activeTab = 'manage'"
                >
                  管理
                </n-button>
                <n-button quaternary size="small"
                  :type="activeTab === 'conflicts' ? 'primary' : 'default'"
                  @click="activeTab = 'conflicts'"
                >
                  冲突
                </n-button>
                <n-button quaternary size="small"
                  :type="activeTab === 'status' ? 'primary' : 'default'"
                  @click="activeTab = 'status'"
                >
                  状态
                </n-button>
              </n-space>
            </div>
          </n-layout-header>

          <n-layout-content class="app-content">
            <!-- Skills 列表 / 详情视图 -->
            <SkillsPage
              v-if="activeTab === 'skills' && !detailView"
              @viewDetail="showDetail"
            />
            <SkillDetailPage
              v-if="activeTab === 'skills' && detailView"
              :skillName="detailSkillName"
              @back="detailView = false"
              @removed="onSkillRemoved"
            />

            <!-- 搜索页（懒加载） -->
            <SearchPage v-else-if="activeTab === 'search'" />

            <!-- 管理页（懒加载） -->
            <ManagePage
              v-else-if="activeTab === 'manage'"
              @viewDetail="showDetailFromOther"
            />

            <!-- 冲突检测页（懒加载） -->
            <ConflictsPage v-else-if="activeTab === 'conflicts'" />

            <!-- 状态页 -->
            <StatusPage v-else-if="activeTab === 'status'" />
          </n-layout-content>
        </n-layout>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue';
import { darkTheme, zhCN, dateZhCN } from 'naive-ui';
import SkillsPage from './pages/SkillsPage.vue';
import StatusPage from './pages/StatusPage.vue';

// 懒加载非首屏页面 — 代码分割优化
const SearchPage = defineAsyncComponent(() => import('./pages/SearchPage.vue'));
const ManagePage = defineAsyncComponent(() => import('./pages/ManagePage.vue'));
const ConflictsPage = defineAsyncComponent(() => import('./pages/ConflictsPage.vue'));
const SkillDetailPage = defineAsyncComponent(() => import('./pages/SkillDetailPage.vue'));

type TabName = 'skills' | 'search' | 'manage' | 'conflicts' | 'status';
const activeTab = ref<TabName>('skills');
const detailView = ref(false);
const detailSkillName = ref('');

function showDetail(name: string) {
  detailSkillName.value = name;
  detailView.value = true;
}

function showDetailFromOther(name: string) {
  activeTab.value = 'skills';
  detailSkillName.value = name;
  detailView.value = true;
}

function onSkillRemoved() {
  detailView.value = false;
}
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-layout {
  height: 100%;
}

.app-header {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.logo-icon {
  font-size: 22px;
}

.app-content {
  padding: 24px;
  height: calc(100% - 56px);
  overflow-y: auto;
}
</style>
