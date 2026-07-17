<script setup lang="ts">
import { ArrowBackOutline, ArrowForwardOutline, MenuOutline, MoonOutline, SearchOutline, SunnyOutline } from '@vicons/ionicons5';
import type { AppTheme } from '../../composables/useAppTheme';

defineProps<{ title: string; subtitle: string; theme: AppTheme; sidebarCollapsed: boolean }>();
defineEmits<{ toggleSidebar: []; toggleTheme: []; openCommand: []; back: []; forward: [] }>();
</script>

<template>
  <header class="app-topbar">
    <div class="window-controls" aria-hidden="true"><i /><i /><i /></div>
    <button class="topbar-icon" type="button" :aria-label="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'" @click="$emit('toggleSidebar')"><n-icon :component="MenuOutline" size="18" /></button>
    <div class="history-controls"><button class="topbar-icon" type="button" aria-label="后退" @click="$emit('back')"><n-icon :component="ArrowBackOutline" size="16" /></button><button class="topbar-icon" type="button" aria-label="前进" @click="$emit('forward')"><n-icon :component="ArrowForwardOutline" size="16" /></button></div>
    <div class="topbar-title"><strong>{{ title }}</strong><span>{{ subtitle }}</span></div>
    <button class="command-entry" type="button" @click="$emit('openCommand')"><n-icon :component="SearchOutline" size="15" /><span>搜索 Skill 或运行命令</span><kbd>⌘ K</kbd></button>
    <button class="theme-toggle" type="button" :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'" :title="theme === 'dark' ? '浅色模式' : '深色模式'" @click="$emit('toggleTheme')"><n-icon :component="theme === 'dark' ? SunnyOutline : MoonOutline" size="16" /><span>{{ theme === 'dark' ? '浅色' : '深色' }}</span></button>
  </header>
</template>

<style scoped>
.app-topbar { position: sticky; top: 0; z-index: 20; display: flex; height: var(--toolbar-height); align-items: center; gap: .7rem; border-bottom: 1px solid var(--color-rule); background: var(--color-toolbar); padding: 0 1.15rem; backdrop-filter: saturate(155%) blur(28px); -webkit-app-region: drag; }.app-topbar button { -webkit-app-region: no-drag; }.window-controls { display:none;align-items:center;gap:.45rem;margin-right:.2rem }.window-controls i{width:.72rem;height:.72rem;border-radius:999px;background:#ff5f57;box-shadow:inset 0 0 0 .5px rgba(0,0,0,.12)}.window-controls i:nth-child(2){background:#febc2e}.window-controls i:nth-child(3){background:#28c840}
.topbar-icon { display:grid;width:2.15rem;height:2.15rem;place-items:center;border:0;border-radius:.55rem;background:transparent;color:var(--color-muted); }.topbar-icon:hover { background:var(--color-paper-3);color:var(--color-ink); }.history-controls { display:flex;gap:.08rem; }.topbar-title { display:flex;min-width:0;align-items:baseline;gap:.65rem; }.topbar-title strong { color:var(--color-ink);font-size:.88rem;font-weight:680;white-space:nowrap; }.topbar-title span { overflow:hidden;max-width:38ch;color:var(--color-muted);font-size:.76rem;text-overflow:ellipsis;white-space:nowrap; }
.command-entry { display:flex;width:min(28rem,36vw);height:2.25rem;align-items:center;gap:.55rem;margin-left:auto;border:1px solid var(--color-rule);border-radius:.62rem;background:color-mix(in srgb,var(--color-paper) 76%,transparent);padding:0 .7rem;color:var(--color-muted);box-shadow:var(--shadow-xs); }.command-entry:hover { border-color:var(--color-rule-strong);background:var(--color-paper); }.command-entry span { overflow:hidden;flex:1;font-size:.76rem;text-align:left;text-overflow:ellipsis;white-space:nowrap; }.command-entry kbd { border:1px solid var(--color-rule);border-radius:.34rem;background:var(--color-paper-2);padding:.08rem .32rem;font-family:var(--font-mono);font-size: .75rem; }
.theme-toggle { display:flex;height:2.15rem;align-items:center;gap:.42rem;border:1px solid var(--color-rule-strong);border-radius:.55rem;background:color-mix(in srgb,var(--color-paper) 76%,transparent);padding:0 .65rem;color:var(--color-muted);font-size:.875rem; }.theme-toggle:hover { background:var(--color-paper);color:var(--color-ink); }
.topbar-title strong { font-size:.9rem; }.topbar-title span { font-size:.8rem; }.command-entry span { font-size:.875rem; }.command-entry kbd { font-size:.75rem; }
@media (display-mode:standalone){.window-controls{display:flex}}
</style>
