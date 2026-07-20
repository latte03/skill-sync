<script setup lang="ts">
import { ArrowBackOutline, ArrowForwardOutline, MenuOutline, MoonOutline, SearchOutline, SunnyOutline } from '@vicons/ionicons5';
import UiIcon from '../ui/UiIcon.vue';
import type { AppTheme } from '../../composables/useAppTheme';

defineProps<{ theme: AppTheme; sidebarCollapsed: boolean }>();
defineEmits<{ toggleSidebar: []; toggleTheme: []; openCommand: []; back: []; forward: [] }>();
</script>

<template>
  <header class="app-topbar">
    <div class="window-controls" aria-hidden="true"><i /><i /><i /></div>
    <button class="topbar-icon" type="button" :aria-label="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'" @click="$emit('toggleSidebar')"><UiIcon :component="MenuOutline" size="17" /></button>
    <div class="history-controls"><button class="topbar-icon" type="button" aria-label="后退" @click="$emit('back')"><UiIcon :component="ArrowBackOutline" size="15" /></button><button class="topbar-icon" type="button" aria-label="前进" @click="$emit('forward')"><UiIcon :component="ArrowForwardOutline" size="15" /></button></div>
    <button class="command-entry" type="button" @click="$emit('openCommand')"><UiIcon :component="SearchOutline" size="14" /><span>搜索或运行命令…</span><kbd>⌘K</kbd></button>
    <button class="topbar-icon theme-toggle" type="button" :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'" @click="$emit('toggleTheme')"><UiIcon :component="theme === 'dark' ? SunnyOutline : MoonOutline" size="16" /></button>
  </header>
</template>

<style scoped>
.app-topbar { position:sticky;top:0;z-index:20;display:flex;height:var(--toolbar-height);align-items:center;gap:.5rem;border-bottom:1px solid var(--color-rule);background:var(--color-toolbar);padding:0 1rem;backdrop-filter:blur(12px);-webkit-app-region:drag; }
.app-topbar button { -webkit-app-region:no-drag; }
.window-controls { display:none;align-items:center;gap:.5rem;margin-right:.25rem; }.window-controls i { width:.75rem;height:.75rem;border-radius:999px;background:#ff5f57; }.window-controls i:nth-child(2) { background:#febc2e; }.window-controls i:nth-child(3) { background:#28c840; }
.topbar-icon { display:grid;width:2rem;height:2rem;place-items:center;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--color-faint);transition:color var(--dur-fast),background var(--dur-fast); }
.topbar-icon:hover { background:var(--color-paper-2);color:var(--color-ink); }
.history-controls { display:flex;gap:2px; }
.command-entry { display:flex;width:min(26rem,34vw);height:2rem;align-items:center;gap:.5rem;margin-left:auto;border:1px solid var(--color-rule-strong);border-radius:var(--radius-sm);background:var(--color-paper);padding:0 .65rem;color:var(--color-faint);font-size:var(--text-sm);transition:border-color var(--dur-fast),box-shadow var(--dur-fast); }
.command-entry:hover { border-color:var(--color-faint);box-shadow:var(--shadow-xs); }
.command-entry span { overflow:hidden;flex:1;text-align:left;text-overflow:ellipsis;white-space:nowrap; }
.command-entry kbd { border:1px solid var(--color-rule-strong);border-radius:var(--radius-xs);background:var(--color-paper-2);padding:.1rem .35rem;color:var(--color-faint);font-family:var(--font-mono);font-size:var(--text-xs); }
.theme-toggle { margin-left:.25rem; }
@media (display-mode:standalone) { .window-controls { display:flex; } }
</style>
