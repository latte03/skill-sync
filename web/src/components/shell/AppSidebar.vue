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

defineProps<{ collapsed: boolean }>();
const route = useRoute();
const groups = [
  { label: '工作区', items: [
    { key: 'skills', label: '技能库', note: 'Skills', path: '/skills', icon: markRaw(AppsOutline) },
    { key: 'search', label: '发现与安装', note: 'Discover', path: '/search', icon: markRaw(CompassOutline) },
  ] },
  { label: '运维', items: [
    { key: 'manage', label: '分发管理', note: 'Distribution', path: '/manage', icon: markRaw(PulseOutline) },
    { key: 'conflicts', label: '一致性检查', note: 'Integrity', path: '/conflicts', icon: markRaw(WarningOutline) },
  ] },
  { label: '系统', items: [
    { key: 'sync', label: '远程同步', note: 'Sync', path: '/sync', icon: markRaw(GitBranchOutline) },
    { key: 'status', label: 'Agent 状态', note: 'Agents', path: '/status', icon: markRaw(ShieldCheckmarkOutline) },
    { key: 'settings', label: '设置', note: 'Settings', path: '/settings', icon: markRaw(OptionsOutline) },
  ] },
];
const activeKey = computed(() => route.meta.navKey as string | undefined);
</script>

<template>
  <aside :class="['app-sidebar', collapsed && 'app-sidebar--collapsed']">
    <div class="brand-row">
      <div class="brand-mark"><n-icon :component="CloudOutline" size="17" /></div>
      <div class="brand-copy"><strong>SkillSync</strong><span>本地 Skill 工作区</span></div>
    </div>
    <nav aria-label="主导航">
      <section v-for="group in groups" :key="group.label">
        <p>{{ group.label }}</p>
        <router-link v-for="item in group.items" :key="item.key" :title="collapsed ? item.label : undefined" :aria-label="item.label" :class="['nav-item', activeKey === item.key && 'nav-item--active']" :to="item.path">
          <n-icon :component="item.icon" size="17" /><span>{{ item.label }}</span><small>{{ item.note }}</small>
        </router-link>
      </section>
    </nav>
    <div class="sidebar-foot"><p><i /><span>核心服务已连接</span><b>0.1.2</b></p></div>
  </aside>
</template>

<style scoped>
.app-sidebar { position: sticky; top: 0; z-index: 30; display: flex; width: var(--sidebar-width); height: 100dvh; flex: none; flex-direction: column; border-right: 1px solid var(--color-rule); background: var(--color-sidebar); color: var(--color-ink); backdrop-filter: saturate(145%) blur(34px); transition: width var(--dur-slow) var(--ease-out); }.app-sidebar--collapsed { width: var(--sidebar-collapsed-width); }
.brand-row { display: flex; height: var(--toolbar-height); flex: none; align-items: center; gap: .8rem; border-bottom: 1px solid var(--color-rule); padding: 0 1rem; overflow: hidden; }.brand-mark { display: grid; width: 2rem; height: 2rem; flex: none; place-items: center; border-radius: .65rem; background: linear-gradient(145deg,#7f86e6,#515cc7); color: #fff; box-shadow: 0 7px 18px rgba(82,94,200,.25); }.brand-copy { min-width: 8.5rem; transition: opacity var(--dur-fast),transform var(--dur-fast); }.brand-copy strong { display: block; color: var(--color-ink); font-size: .88rem; font-weight: 700; letter-spacing: -.025em; }.brand-copy span { display: block; margin-top: .1rem; color: var(--color-muted); font-size: .75rem; }.app-sidebar--collapsed .brand-copy { opacity: 0; transform: translateX(-.4rem); }
nav { display: grid; flex: 1; align-content: start; gap: 1.35rem; overflow: hidden auto; padding: 1rem .7rem; }nav section { display: grid; gap: .28rem; }nav section>p { height: 1rem; margin: 0 0 .25rem; padding: 0 .65rem; overflow: hidden; color: var(--color-faint); font-size: .75rem; font-weight: 650; letter-spacing: .08em; white-space: nowrap; }.nav-item { display: grid; min-height: 2.55rem; grid-template-columns: 1.35rem minmax(0,1fr) auto; align-items: center; gap: .65rem; border-radius: .62rem; padding: 0 .65rem; color: var(--color-muted); font-size: .82rem; font-weight: 560; text-decoration: none; transition: color var(--dur-fast),background var(--dur-fast),box-shadow var(--dur-fast); }.nav-item span,.nav-item small { white-space: nowrap; }.nav-item small { color: var(--color-faint); font-size: .75rem; }.nav-item:hover { background: color-mix(in srgb,var(--color-paper) 68%,transparent); color: var(--color-ink); }.nav-item--active { background: var(--color-paper); color: var(--color-ink); box-shadow: var(--shadow-xs),inset 0 0 0 1px var(--color-rule); }.nav-item--active :deep(svg) { color: var(--color-accent); }.app-sidebar--collapsed nav { padding-inline: .65rem; }.app-sidebar--collapsed nav section>p { opacity: 0; }.app-sidebar--collapsed .nav-item { grid-template-columns: 1.35rem; justify-content: center; padding: 0; }.app-sidebar--collapsed .nav-item span,.app-sidebar--collapsed .nav-item small { display: none; }
.sidebar-foot { flex: none; border-top: 1px solid var(--color-rule); padding: .8rem .75rem; overflow: hidden; }.sidebar-foot p { display: flex; min-height: 2rem; align-items: center; gap: .45rem; margin: 0; padding: 0 .55rem; color: var(--color-muted); font-size: .75rem; white-space: nowrap; }.sidebar-foot p i { width: .42rem; height: .42rem; flex: none; border-radius: 999px; background: var(--color-success);box-shadow:0 0 0 3px var(--color-success-soft); }.sidebar-foot p b { margin-left: auto; color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; font-weight: 500; }.app-sidebar--collapsed .sidebar-foot p { justify-content:center;padding:0; }.app-sidebar--collapsed .sidebar-foot span,.app-sidebar--collapsed .sidebar-foot b { display:none; }
.brand-copy span,nav section>p,.nav-item small,.sidebar-foot p,.sidebar-foot p b { font-size:.75rem; }
.nav-item { min-height:2.7rem;font-size:.875rem; }
.nav-item:hover { background:color-mix(in srgb,var(--color-paper) 84%,transparent);box-shadow:inset 0 0 0 1px var(--color-rule); }
.nav-item--active { box-shadow:var(--shadow-sm),inset 0 0 0 1px var(--color-rule-strong); }
.sidebar-foot { height:var(--statusbar-height);padding:0; }
.sidebar-foot p { height:100%;min-height:0;padding:0 1.25rem; }
</style>
