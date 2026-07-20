<script setup lang="ts">
import { computed, markRaw } from 'vue';
import { useRoute } from 'vue-router';
import {
  AppsOutline,
  CloudOutline,
  CompassOutline,
  GitBranchOutline,
  OptionsOutline,
  PulseOutline,
  ShieldCheckmarkOutline,
  WarningOutline,
} from '@vicons/ionicons5';
import UiIcon from '../ui/UiIcon.vue';

defineProps<{ collapsed: boolean }>();
const route = useRoute();
const groups = [
  { label: '工作区', items: [
    { key: 'skills', label: '技能库', path: '/skills', icon: markRaw(AppsOutline) },
    { key: 'search', label: '发现与安装', path: '/search', icon: markRaw(CompassOutline) },
  ] },
  { label: '运维', items: [
    { key: 'manage', label: '分发管理', path: '/manage', icon: markRaw(PulseOutline) },
    { key: 'conflicts', label: '一致性检查', path: '/conflicts', icon: markRaw(WarningOutline) },
  ] },
  { label: '系统', items: [
    { key: 'sync', label: '远程同步', path: '/sync', icon: markRaw(GitBranchOutline) },
    { key: 'status', label: 'Agent 状态', path: '/status', icon: markRaw(ShieldCheckmarkOutline) },
    { key: 'settings', label: '设置', path: '/settings', icon: markRaw(OptionsOutline) },
  ] },
];
const activeKey = computed(() => route.meta.navKey as string | undefined);
</script>

<template>
  <aside :class="['app-sidebar', collapsed && 'app-sidebar--collapsed']">
    <div class="brand-row">
      <div class="brand-mark"><UiIcon :component="CloudOutline" size="15" /></div>
      <span class="brand-name">SkillSync</span>
    </div>
    <nav aria-label="主导航">
      <section v-for="group in groups" :key="group.label">
        <p>{{ group.label }}</p>
        <router-link v-for="item in group.items" :key="item.key" :title="collapsed ? item.label : undefined" :aria-label="item.label" :class="['nav-item','mb-2', activeKey === item.key && 'nav-item--active']" :to="item.path">
          <UiIcon :component="item.icon" size="16" /><span>{{ item.label }}</span>
        </router-link>
      </section>
    </nav>
    <div class="sidebar-foot"><i /><span>已连接</span><b>0.1.2</b></div>
  </aside>
</template>

<style scoped>
.app-sidebar { position:sticky;top:0;z-index:30;display:flex;width:var(--sidebar-width);height:100dvh;flex:none;flex-direction:column;border-right:1px solid var(--color-rule);background:var(--color-sidebar);color:var(--color-ink);transition:width var(--dur-slow) var(--ease-out); }
.app-sidebar--collapsed { width:var(--sidebar-collapsed-width); }

.brand-row { display:flex;height:var(--toolbar-height);flex:none;align-items:center;gap:.6rem;padding:0 .875rem;overflow:hidden; }
.brand-mark { display:grid;width:1.625rem;height:1.625rem;flex:none;place-items:center;border-radius:var(--radius-sm);background:var(--color-accent);color:#fff; }
.brand-name { color:var(--color-ink);font-size:var(--text-sm);font-weight:650;letter-spacing:-.02em;white-space:nowrap;transition:opacity var(--dur-fast); }
.app-sidebar--collapsed .brand-name { opacity:0; }

nav { display:grid;flex:1;align-content:start;gap:1.25rem;overflow:hidden auto;padding:.875rem .5rem; }
nav section { display:grid;gap:1px; }
nav section > p { margin:0 0 .375rem;padding:0 .5rem;color:var(--color-faint);font-size:var(--text-xs);font-weight:600;letter-spacing:.04em;white-space:nowrap; }
.app-sidebar--collapsed nav section > p { opacity:0;height:0;margin:0;overflow:hidden; }

.nav-item { display:flex;height:2.5rem;align-items:center;gap:.5rem;border-radius:var(--radius-sm);padding:0 .5rem;color:var(--color-muted);font-size:var(--text-base);font-weight:500;text-decoration:none;transition:color var(--dur-fast),background var(--dur-fast); }
.nav-item span { white-space:nowrap; }
.nav-item:hover { background:var(--color-paper-3);color:var(--color-ink); }
.nav-item:hover :deep(svg) { color:var(--color-ink); }
.nav-item--active { background:var(--color-accent)!important;color:var(--color-accent-ink)!important;font-weight:550; }
.nav-item--active :deep(svg) { color:var(--color-accent-ink)!important; }

.app-sidebar--collapsed nav { padding-inline:.5rem; }
.app-sidebar--collapsed .nav-item { justify-content:center;padding:0; }
.app-sidebar--collapsed .nav-item span { display:none; }

.sidebar-foot { display:flex;height:2.5rem;flex:none;align-items:center;gap:.4rem;border-top:1px solid var(--color-rule);padding:0 .875rem;color:var(--color-faint);font-size:var(--text-xs);white-space:nowrap; }
.sidebar-foot i { width:.375rem;height:.375rem;flex:none;border-radius:999px;background:var(--color-success); }
.sidebar-foot b { margin-left:auto;color:var(--color-faint);font-family:var(--font-mono);font-weight:450; }
.app-sidebar--collapsed .sidebar-foot { justify-content:center;padding:0; }
.app-sidebar--collapsed .sidebar-foot span,.app-sidebar--collapsed .sidebar-foot b { display:none; }
</style>
