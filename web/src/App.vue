<template>
  <n-config-provider
    :theme="activeTheme"
    :theme-overrides="activeThemeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
    inline-theme-disabled
  >
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <div class="app-shell" :data-theme="isDark ? 'dark' : 'light'">
          <!-- ───── Sidebar ───── -->
          <aside class="sidebar">
            <!-- Logo -->
            <div class="sidebar-header">
              <div class="logo-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M13 2L4.5 12.6c-.4.5 0 1.2.6 1.2H10l-1.4 7.2c-.1.7.8 1.1 1.3.5L19.5 11.4c.4-.5 0-1.2-.6-1.2H14l1.4-7.2c.1-.7-.8-1.1-1.3-.5z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div class="logo-info">
                <span class="logo-text">SkillSync</span>
                <span class="logo-subtitle">AI Skill Manager</span>
              </div>
            </div>

            <!-- Navigation -->
            <nav class="sidebar-nav">
              <div class="nav-section-label">资料库</div>
              <router-link
                v-for="item in navItems.slice(0, 2)"
                :key="item.key"
                :to="item.path"
                class="nav-item"
                :class="{ active: isActiveNav(item.key) }"
              >
                <n-icon size="18" class="nav-icon">
                  <component :is="item.icon" />
                </n-icon>
                <span class="nav-label">{{ item.label }}</span>
              </router-link>

              <div class="nav-section-label">分发与同步</div>
              <router-link
                v-for="item in navItems.slice(2, 5)"
                :key="item.key"
                :to="item.path"
                class="nav-item"
                :class="{ active: isActiveNav(item.key) }"
              >
                <n-icon size="18" class="nav-icon">
                  <component :is="item.icon" />
                </n-icon>
                <span class="nav-label">{{ item.label }}</span>
              </router-link>

              <div class="nav-section-label">系统</div>
              <router-link
                v-for="item in navItems.slice(5)"
                :key="item.key"
                :to="item.path"
                class="nav-item"
                :class="{ active: isActiveNav(item.key) }"
              >
                <n-icon size="18" class="nav-icon">
                  <component :is="item.icon" />
                </n-icon>
                <span class="nav-label">{{ item.label }}</span>
              </router-link>
            </nav>

            <!-- Footer -->
            <div class="sidebar-footer">
              <button
                type="button"
                class="theme-toggle"
                :aria-label="isDark ? '切换到浅色' : '切换到深色'"
                @click="toggleTheme"
              >
                <n-icon size="14">
                  <SunnyOutline v-if="isDark" />
                  <MoonOutline v-else />
                </n-icon>
                <span>{{ isDark ? '浅色' : '深色' }}</span>
              </button>
              <div class="server-status">
                <span class="status-dot online"></span>
                <span class="status-text">localhost:17170</span>
              </div>
            </div>
          </aside>

          <!-- ───── Main Content ───── -->
          <main class="main-content">
            <div class="content-wrapper">
              <router-view v-slot="{ Component }">
                <transition name="fade-slide" mode="out-in">
                  <component :is="Component" />
                </transition>
              </router-view>
            </div>
          </main>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { markRaw, computed, ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { lightTheme, darkTheme, zhCN, dateZhCN } from 'naive-ui';
import type { GlobalThemeOverrides } from 'naive-ui';
import {
  CubeOutline,
  SearchOutline,
  SettingsOutline,
  WarningOutline,
  BarChartOutline,
  FlashOutline,
  SyncOutline,
  MoonOutline,
  SunnyOutline,
} from '@vicons/ionicons5';

const route = useRoute();

type NavItem = {
  key: string;
  label: string;
  path: string;
  icon: typeof CubeOutline;
};

const navItems: NavItem[] = [
  { key: 'skills', label: 'Skills', path: '/skills', icon: markRaw(CubeOutline) },
  { key: 'search', label: '搜索', path: '/search', icon: markRaw(SearchOutline) },
  { key: 'manage', label: '管理', path: '/manage', icon: markRaw(SettingsOutline) },
  { key: 'sync', label: '同步', path: '/sync', icon: markRaw(SyncOutline) },
  { key: 'conflicts', label: '冲突', path: '/conflicts', icon: markRaw(WarningOutline) },
  { key: 'settings', label: '设置', path: '/settings', icon: markRaw(SettingsOutline) },
  { key: 'status', label: '状态', path: '/status', icon: markRaw(BarChartOutline) },
];

const isActiveNav = computed(() => (key: string) => route.meta.navKey === key);

// ─── Theme: system preference + manual override ───────────────────────
const THEME_KEY = 'skillsync-theme';
const isDark = ref(false);

function applySystem() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') {
    isDark.value = stored === 'dark';
  } else {
    isDark.value =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}

function toggleTheme() {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light');
}

onMounted(() => {
  applySystem();
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_KEY) === null) isDark.value = e.matches;
    };
    mq.addEventListener('change', handler);
  }
});

watch(isDark, (v) => {
  document.documentElement.setAttribute('data-theme', v ? 'dark' : 'light');
}, { immediate: true });

const activeTheme = computed(() => (isDark.value ? darkTheme : lightTheme));

// ─── Theme Overrides — single accent, neutrals, dual-mode tokens ──────
const activeThemeOverrides = computed<GlobalThemeOverrides>(() =>
  isDark.value ? darkOverrides : lightOverrides
);

const lightOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#007AFF',
    primaryColorHover: '#2a8cff',
    primaryColorPressed: '#0062cc',
    primaryColorSuppl: '#007AFF',
    infoColor: '#007AFF',
    infoColorHover: '#2a8cff',
    infoColorPressed: '#0062cc',
    successColor: '#34c759',
    successColorHover: '#2bb24c',
    successColorPressed: '#249a3f',
    warningColor: '#ff9500',
    warningColorHover: '#ffa726',
    warningColorPressed: '#e68600',
    errorColor: '#ff3b30',
    errorColorHover: '#ff5247',
    errorColorPressed: '#d70022',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    textColorBase: '#1d1d20',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontWeightStrong: '600',
  },
  Card: {
    borderRadius: '10px',
    color: '#ffffff',
    colorModal: '#ffffff',
    colorEmbedded: '#f7f7f9',
  },
  Button: {
    borderRadiusLarge: '8px',
    borderRadiusMedium: '8px',
    borderRadiusSmall: '6px',
    borderRadiusTiny: '6px',
    fontWeight: '500',
  },
  Tag: {
    borderRadius: '4px',
  },
  Input: {
    borderRadius: '8px',
  },
};

const darkOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#0a84ff',
    primaryColorHover: '#3a9eff',
    primaryColorPressed: '#0062cc',
    primaryColorSuppl: '#0a84ff',
    infoColor: '#0a84ff',
    infoColorHover: '#3a9eff',
    infoColorPressed: '#0062cc',
    successColor: '#30d158',
    successColorHover: '#3ad968',
    successColorPressed: '#27b34a',
    warningColor: '#ff9f0a',
    warningColorHover: '#ffaf2e',
    warningColorPressed: '#e08600',
    errorColor: '#ff453a',
    errorColorHover: '#ff6155',
    errorColorPressed: '#d12d23',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    textColorBase: '#ecedee',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontWeightStrong: '600',
  },
  Card: {
    borderRadius: '10px',
    color: '#161618',
    colorModal: '#1a1a1d',
    colorEmbedded: '#111113',
  },
  Button: {
    borderRadiusLarge: '8px',
    borderRadiusMedium: '8px',
    borderRadiusSmall: '6px',
    borderRadiusTiny: '6px',
    fontWeight: '500',
  },
  Tag: {
    borderRadius: '4px',
  },
  Input: {
    borderRadius: '8px',
  },
};
</script>

<style>
/* ─── Global Reset & Surface Tokens ─────────────────────────────────
   One accent (apple-blue), flat surfaces, no mesh wallpaper, dual-mode. */
:root {
  --bg: #f4f5f7;
  --surface: #ffffff;
  --surface-2: #f7f7f9;
  --surface-hover: #f0f1f3;
  --border: #e8e8eb;
  --border-strong: #dcdce0;
  --text: #1d1d20;
  --text-2: #5b5b66;
  --text-3: #8a8a92;
  --accent: #007aff;
  --accent-soft: rgba(0, 122, 255, 0.1);
  --accent-border: rgba(0, 122, 255, 0.28);
  --success: #34c759;
  --warning: #ff9500;
  --danger: #ff3b30;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
}

[data-theme='dark'] {
  --bg: #0c0c0e;
  --surface: #161618;
  --surface-2: #111113;
  --surface-hover: #1f1f23;
  --border: #26262b;
  --border-strong: #34343a;
  --text: #ecedee;
  --text-2: #a0a0a8;
  --text-3: #6b6b73;
  --accent: #0a84ff;
  --accent-soft: rgba(10, 132, 255, 0.16);
  --accent-border: rgba(10, 132, 255, 0.35);
  --success: #30d158;
  --warning: #ff9f0a;
  --danger: #ff453a;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue',
    Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg);
  color: var(--text);
}

/* ─── App Shell ─────────────────────────────────────────────────── */
.app-shell {
  display: flex;
  height: 100vh;
  width: 100%;
}

/* ─── Sidebar ────────────────────────────────────────────────────── */
.sidebar {
  width: 240px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  z-index: 10;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 20px 18px 16px;
  border-bottom: 1px solid var(--border);
}

.logo-icon-wrap {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.logo-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.logo-subtitle {
  font-size: 11px;
  color: var(--text-3);
  display: block;
  margin-top: 1px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 10px 10px;
  flex: 1;
  overflow-y: auto;
}

.nav-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 10px 10px 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
  text-align: left;
  width: 100%;
  font-family: inherit;
  text-decoration: none;
}

.nav-item:hover:not(.active) {
  background: var(--surface-hover);
  color: var(--text);
}

.nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.nav-icon {
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
}

.sidebar-footer {
  padding: 10px 14px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.theme-toggle:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.server-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--success);
}

.status-text {
  font-size: 11px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

/* ─── Main Content ─────────────────────────────────────────────────── */
.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  background: var(--bg);
}

.content-wrapper {
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 40px 48px;
  min-height: 100%;
}

/* ─── Page Transitions ─────────────────────────────────────────────── */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ─── Scrollbar ────────────────────────────────────────────────── */
.main-content::-webkit-scrollbar,
.sidebar-nav::-webkit-scrollbar {
  width: 8px;
}

.main-content::-webkit-scrollbar-track,
.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.main-content::-webkit-scrollbar-thumb,
.sidebar-nav::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 4px;
}

.main-content::-webkit-scrollbar-thumb:hover,
.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: var(--text-3);
}

/* ─── Shared page primitives (used across views via :global-ish usage) ── */
.page-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.015em;
}
</style>