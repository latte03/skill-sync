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
                <n-button quaternary size="small" @click="activeTab = 'skills'">
                  Skills
                </n-button>
                <n-button quaternary size="small" @click="activeTab = 'search'">
                  搜索
                </n-button>
                <n-button quaternary size="small" @click="activeTab = 'status'">
                  状态
                </n-button>
              </n-space>
            </div>
          </n-layout-header>

          <n-layout-content class="app-content">
            <SkillsPage v-if="activeTab === 'skills'" />
            <SearchPage v-else-if="activeTab === 'search'" />
            <StatusPage v-else-if="activeTab === 'status'" />
          </n-layout-content>
        </n-layout>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { darkTheme, zhCN, dateZhCN } from 'naive-ui';
import SkillsPage from './pages/SkillsPage.vue';
import SearchPage from './pages/SearchPage.vue';
import StatusPage from './pages/StatusPage.vue';

const activeTab = ref<'skills' | 'search' | 'status'>('skills');
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
