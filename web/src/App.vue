<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { darkTheme, lightTheme, zhCN, dateZhCN } from 'naive-ui';
import { MotionConfig } from 'motion-v';
import AppSidebar from './components/shell/AppSidebar.vue';
import AppTopbar from './components/shell/AppTopbar.vue';
import AppCommandPalette from './components/shell/AppCommandPalette.vue';
import { useAppTheme } from './composables/useAppTheme';

const route = useRoute();
const router = useRouter();
const { theme, toggleTheme } = useAppTheme();
const commandOpen = shallowRef(false);
const sidebarCollapsed = shallowRef(localStorage.getItem('skillsync:sidebar-collapsed') === 'true');
const routeStage = shallowRef<HTMLElement | null>(null);
const routeTitle = computed(() => String(route.meta.title ?? 'SkillSync'));
const routeSubtitle = computed(() => String(route.meta.subtitle ?? '管理本地 Skill 的生命周期与分发'));
const activeTheme = computed(() => theme.value === 'dark' ? darkTheme : lightTheme);
const themeOverrides = computed(() => {
  const dark = theme.value === 'dark';
  const primary = dark ? '#8b92f4' : '#5e6ad2';
  return { common: { primaryColor: primary, primaryColorHover: dark ? '#9da3ff' : '#515cc4', primaryColorPressed: primary, primaryColorSuppl: primary, borderRadius: '8px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' } };
});
function onKeydown(event: KeyboardEvent) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); commandOpen.value = !commandOpen.value; } }
function resetRouteScroll() { routeStage.value?.scrollTo({ top: 0, left: 0 }); }
watch(sidebarCollapsed, value => localStorage.setItem('skillsync:sidebar-collapsed', String(value)));
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <n-config-provider :theme="activeTheme" :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN" inline-theme-disabled>
    <n-global-style />
    <MotionConfig reduced-motion="user"><n-message-provider><n-dialog-provider>
      <div class="app-shell">
        <AppSidebar :collapsed="sidebarCollapsed" />
        <main class="app-content">
          <AppTopbar :title="routeTitle" :subtitle="routeSubtitle" :theme="theme" :sidebar-collapsed="sidebarCollapsed" @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed" @toggle-theme="toggleTheme" @open-command="commandOpen = true" @back="router.back()" @forward="router.forward()" />
          <section ref="routeStage" class="route-stage"><router-view v-slot="{ Component }"><transition name="route" mode="out-in" @before-enter="resetRouteScroll"><component :is="Component" :key="route.path" /></transition></router-view></section>
          <footer class="statusbar"><span><i />工作区正常</span><span>本地模式</span><span>安全操作从预览开始</span><b>SkillSync Core · local</b></footer>
        </main>
        <AppCommandPalette v-model:open="commandOpen" />
      </div>
    </n-dialog-provider></n-message-provider></MotionConfig>
  </n-config-provider>
</template>

<style>
.app-shell { display:flex;min-width:80rem;height:100dvh;min-height:100dvh;overflow:hidden;background:var(--color-canvas); }.app-content { display:grid;min-width:0;height:100dvh;min-height:0;flex:1;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden; }.route-stage { min-width:0;min-height:0;overflow-x:clip;overflow-y:auto;scrollbar-gutter:stable;background:var(--color-canvas); }.route-stage::-webkit-scrollbar-track { background:var(--color-canvas); }.statusbar { position:relative;z-index:18;display:flex;height:var(--statusbar-height);flex:none;align-items:center;gap:1.5rem;border-top:1px solid var(--color-rule);background:var(--color-toolbar);padding:0 1.25rem;color:var(--color-muted);font-family:var(--font-mono);font-size:.75rem;letter-spacing:.03em;backdrop-filter:saturate(150%) blur(26px); }.statusbar span { display:flex;align-items:center;gap:.45rem; }.statusbar span i { width:.42rem;height:.42rem;border-radius:999px;background:var(--color-success);box-shadow:0 0 0 3px var(--color-success-soft); }.statusbar b { margin-left:auto;font-weight:500; }.route-enter-active { transition:opacity var(--dur-slow) var(--ease-out),transform var(--dur-slow) var(--ease-out),filter var(--dur-base) var(--ease-out); }.route-leave-active { transition:opacity var(--dur-fast) var(--ease-in),transform var(--dur-fast) var(--ease-in); }.route-enter-from { opacity:0;transform:translate3d(0,.65rem,0) scale(.992);filter:blur(4px); }.route-leave-to { opacity:0;transform:translate3d(0,-.25rem,0) scale(.997); }
</style>
