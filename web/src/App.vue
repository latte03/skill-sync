<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MotionConfig } from 'motion-v';
import AppSidebar from './components/shell/AppSidebar.vue';
import AppTopbar from './components/shell/AppTopbar.vue';
import AppCommandPalette from './components/shell/AppCommandPalette.vue';
import UiToast from './components/ui/UiToast.vue';
import { useAppTheme } from './composables/useAppTheme';

const route = useRoute();
const router = useRouter();
const { theme, toggleTheme } = useAppTheme();
const commandOpen = shallowRef(false);
const sidebarCollapsed = shallowRef(localStorage.getItem('skillsync:sidebar-collapsed') === 'true');
const routeStage = shallowRef<HTMLElement | null>(null);
function onKeydown(event: KeyboardEvent) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); commandOpen.value = !commandOpen.value; } }
function resetRouteScroll() { routeStage.value?.querySelector('.floating-panel')?.scrollTo({ top: 0, left: 0 }); }
watch(sidebarCollapsed, value => localStorage.setItem('skillsync:sidebar-collapsed', String(value)));
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <MotionConfig reduced-motion="user">
    <div class="app-shell">
      <AppSidebar :collapsed="sidebarCollapsed" />
      <main class="app-content">
        <AppTopbar :theme="theme" :sidebar-collapsed="sidebarCollapsed" @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed" @toggle-theme="toggleTheme" @open-command="commandOpen = true" @back="router.back()" @forward="router.forward()" />
        <section ref="routeStage" class="route-stage"><div class="floating-panel"><router-view v-slot="{ Component }"><transition name="route" mode="out-in" @before-enter="resetRouteScroll"><component :is="Component" :key="route.path" /></transition></router-view></div></section>
      </main>
      <AppCommandPalette v-model:open="commandOpen" />
      <UiToast />
    </div>
  </MotionConfig>
</template>

<style>
.app-shell { display:flex;height:100dvh;min-height:100dvh;overflow:hidden;background:var(--color-canvas); }
.app-content { display:grid;min-width:0;height:100dvh;min-height:0;flex:1;grid-template-rows:auto minmax(0,1fr);overflow:hidden; }
.route-stage { min-width:0;min-height:0;overflow:hidden;background:var(--color-canvas);padding:.75rem; }
.floating-panel { height:100%;overflow-x:clip;overflow-y:auto;scrollbar-gutter:stable;border-radius:var(--radius-xl);background:var(--color-paper);box-shadow:0 0 0 1px var(--color-rule),0 2px 8px rgba(0,0,0,0.06),0 8px 32px rgba(0,0,0,0.08); }
.floating-panel::-webkit-scrollbar-track { background:transparent; }
.floating-panel::-webkit-scrollbar { width:6px; }
.floating-panel::-webkit-scrollbar-thumb { background:var(--color-paper-3);border-radius:3px; }
.route-enter-active { transition:opacity var(--dur-base) var(--ease-out),transform var(--dur-base) var(--ease-out); }
.route-leave-active { transition:opacity var(--dur-fast) var(--ease-in),transform var(--dur-fast) var(--ease-in); }
.route-enter-from { opacity:0;transform:translateY(4px); }
.route-leave-to { opacity:0;transform:translateY(-2px); }
</style>
