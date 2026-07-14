<template>
  <n-config-provider
    :theme="lightTheme"
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <div class="app-shell">
          <!-- ───── Glass Sidebar ───── -->
          <aside class="sidebar">
            <!-- Logo -->
            <div class="sidebar-header">
              <div class="logo-icon-wrap">
                <n-icon size="20" color="#fff">
                  <FlashOutline />
                </n-icon>
              </div>
              <div class="logo-info">
                <span class="logo-text">SkillSync</span>
                <span class="logo-subtitle">AI Skill Manager</span>
                  </div>
            </div>

            <!-- Navigation -->
            <nav class="sidebar-nav">
              <div class="nav-section-label">导航</div>
              <button
                v-for="item in navItems"
                :key="item.key"
                class="nav-item"
                :class="{ active: activeTab === item.key && !(item.key === 'skills' && detailView) }"
                @click="handleNavClick(item.key)"
              >
                <n-icon size="19" class="nav-icon">
                  <component :is="item.icon" />
                </n-icon>
                <span class="nav-label">{{ item.label }}</span>
              </button>
            </nav>

            <!-- Footer -->
            <div class="sidebar-footer">
              <div class="server-status">
                <span class="status-dot online"></span>
                <span class="status-text">localhost:17170</span>
              </div>
            </div>
          </aside>

          <!-- ───── Main Content ───── -->
          <main class="main-content">
            <div class="content-wrapper">
              <transition name="fade-slide" mode="out-in">
                <SkillsPage
                  v-if="activeTab === 'skills' && !detailView"
                  key="skills-list"
                  @viewDetail="showDetail"
                />
                <SkillDetailPage
                  v-else-if="activeTab === 'skills' && detailView"
                  key="skill-detail"
                  :skillName="detailSkillName"
                  @back="detailView = false"
                  @removed="onSkillRemoved"
                />
                <SearchPage v-else-if="activeTab === 'search'" key="search" />
                <ManagePage
                  v-else-if="activeTab === 'manage'"
                  key="manage"
                  @viewDetail="showDetailFromOther"
                />
                <ConflictsPage v-else-if="activeTab === 'conflicts'" key="conflicts" />
                <SyncPage v-else-if="activeTab === 'sync'" key="sync" />
                <SettingsPage v-else-if="activeTab === 'settings'" key="settings" />
                <StatusPage v-else-if="activeTab === 'status'" key="status" />
              </transition>
            </div>
          </main>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, markRaw, defineAsyncComponent } from 'vue';
import { lightTheme, zhCN, dateZhCN } from 'naive-ui';
import type { GlobalThemeOverrides } from 'naive-ui';
import {
  CubeOutline,
  SearchOutline,
  SettingsOutline,
  WarningOutline,
  BarChartOutline,
  FlashOutline,
  SyncOutline,
} from '@vicons/ionicons5';
import SkillsPage from './pages/SkillsPage.vue';
import StatusPage from './pages/StatusPage.vue';

// Lazy-load non-first-screen pages
const SearchPage = defineAsyncComponent(() => import('./pages/SearchPage.vue'));
const ManagePage = defineAsyncComponent(() => import('./pages/ManagePage.vue'));
const ConflictsPage = defineAsyncComponent(() => import('./pages/ConflictsPage.vue'));
const SkillDetailPage = defineAsyncComponent(() => import('./pages/SkillDetailPage.vue'));
const SyncPage = defineAsyncComponent(() => import('./pages/SyncPage.vue'));
const SettingsPage = defineAsyncComponent(() => import('./pages/SettingsPage.vue'));

type TabName = 'skills' | 'search' | 'manage' | 'conflicts' | 'status' | 'sync' | 'settings';

const navItems = [
  { key: 'skills' as TabName, label: 'Skills', icon: markRaw(CubeOutline) },
  { key: 'search' as TabName, label: '搜索', icon: markRaw(SearchOutline) },
  { key: 'manage' as TabName, label: '管理', icon: markRaw(SettingsOutline) },
  { key: 'sync' as TabName, label: '同步', icon: markRaw(SyncOutline) },
  { key: 'settings' as TabName, label: '设置', icon: markRaw(SettingsOutline) },
  { key: 'conflicts' as TabName, label: '冲突', icon: markRaw(WarningOutline) },
  { key: 'status' as TabName, label: '状态', icon: markRaw(BarChartOutline) },
];

const activeTab = ref<TabName>('skills');
const detailView = ref(false);
const detailSkillName = ref('');

// ─── Theme Overrides — Apple System Colors ───────────────────────
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#007AFF',
    primaryColorHover: '#3395FF',
    primaryColorPressed: '#0062CC',
    primaryColorSuppl: '#007AFF',
    infoColor: '#5AC8FA',
    infoColorHover: '#7AD5FB',
    infoColorPressed: '#42B4E8',
    successColor: '#34C759',
    successColorHover: '#2BB24C',
    successColorPressed: '#249A3F',
    warningColor: '#FF9500',
    warningColorHover: '#FFA726',
    warningColorPressed: '#E68600',
    errorColor: '#FF3B30',
    errorColorHover: '#FF5247',
    errorColorPressed: '#D70022',
    borderRadius: '12px',
    borderRadiusSmall: '8px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontWeightStrong: '600',
  },
  Card: {
    borderRadius: '16px',
    color: 'rgba(255, 255, 255, 0.72)',
    colorModal: 'rgba(255, 255, 255, 0.92)',
    colorEmbedded: 'rgba(255, 255, 255, 0.50)',
  },
  Button: {
    borderRadiusLarge: '20px',
    borderRadiusMedium: '12px',
    borderRadiusSmall: '8px',
    borderRadiusTiny: '6px',
    fontWeight: '500',
  },
  Tag: {
    borderRadius: '6px',
  },
  Input: {
    borderRadius: '10px',
  },
};

// ─── Navigation ───────────────────────────────────────────────────
function handleNavClick(key: TabName) {
  activeTab.value = key;
  detailView.value = false;
}

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
/* ─── Global Reset & Background ─────────────────────────────────── */
html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
    'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #f5f5f7;
  /* Tahoe-style mesh gradient wallpaper */
  background-image:
    radial-gradient(at 6% 4%, rgba(0, 122, 255, 0.14) 0px, transparent 45%),
    radial-gradient(at 94% 8%, rgba(175, 82, 222, 0.12) 0px, transparent 45%),
    radial-gradient(at 88% 92%, rgba(255, 149, 0, 0.09) 0px, transparent 45%),
    radial-gradient(at 12% 96%, rgba(52, 199, 89, 0.10) 0px, transparent 45%);
  background-attachment: fixed;
}

/* ─── App Shell ─────────────────────────────────────────────────── */
.app-shell {
  display: flex;
  height: 100vh;
  width: 100%;
}

/* ─── Glass Sidebar ─────────────────────────────────────────────── */
.sidebar {
  width: 256px;
  min-width: 256px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.52);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-right: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow:
    inset -1px 0 0 rgba(255, 255, 255, 0.5),
    1px 0 12px rgba(0, 0, 0, 0.03);
  z-index: 10;
}

/* Logo block */
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 20px 18px;
}

.logo-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #007aff 0%, #5856d6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 10px rgba(0, 122, 255, 0.28);
}

.logo-text {
  font-size: 17px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.logo-subtitle {
  font-size: 11px;
  color: #86868b;
  display: block;
  margin-top: 1px;
}

/* Navigation */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 12px;
  flex: 1;
  overflow-y: auto;
}

.nav-section-label {
  font-size: 11px;
  font-weight: 600;
  color: #86868b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 8px 12px 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #424245;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
  text-align: left;
  width: 100%;
  font-family: inherit;
}

.nav-item:hover:not(.active) {
  background: rgba(0, 0, 0, 0.04);
}

.nav-item.active {
  background: rgba(0, 122, 255, 0.10);
  color: #007aff;
}

.nav-item.active .nav-icon {
  transform: scale(1.05);
}

.nav-icon {
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
}

/* Sidebar footer */
.sidebar-footer {
  padding: 14px 20px 18px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.server-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online {
  background: #34c759;
  box-shadow: 0 0 8px rgba(52, 199, 89, 0.45);
}

.status-text {
  font-size: 12px;
  color: #86868b;
  font-variant-numeric: tabular-nums;
}

/* ─── Main Content ─────────────────────────────────────────────── */
.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 36px 44px 48px;
  min-height: 100%;
}

/* ─── Page Transitions ─────────────────────────────────────────── */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ─── Scrollbar ────────────────────────────────────────────────── */
.main-content::-webkit-scrollbar,
.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.main-content::-webkit-scrollbar-track,
.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.main-content::-webkit-scrollbar-thumb,
.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 3px;
}

.main-content::-webkit-scrollbar-thumb:hover,
.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}
</style>
