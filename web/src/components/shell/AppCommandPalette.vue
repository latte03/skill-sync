<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { AppsOutline, CompassOutline, GitBranchOutline, OptionsOutline, PulseOutline, SearchOutline, ShieldCheckmarkOutline } from '@vicons/ionicons5';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';

const open = defineModel<boolean>('open', { required: true });
const router = useRouter();
const query = shallowRef('');
const input = shallowRef<HTMLInputElement | null>(null);
const commands = [
  { label: '打开技能库', hint: '查看本地 Skill', path: '/skills', icon: AppsOutline },
  { label: '打开发现与安装', hint: '搜索与安装 Skill', path: '/search', icon: CompassOutline },
  { label: '打开分发管理', hint: '查看分发关系', path: '/manage', icon: PulseOutline },
  { label: '打开 Agent 状态', hint: '运行与覆盖状态', path: '/status', icon: ShieldCheckmarkOutline },
  { label: '打开远程同步', hint: '同步工作区', path: '/sync', icon: GitBranchOutline },
  { label: '打开设置', hint: '连接与偏好', path: '/settings', icon: OptionsOutline },
];
const filtered = computed(() => { const value = query.value.trim().toLowerCase(); return value ? commands.filter(item => `${item.label} ${item.hint}`.toLowerCase().includes(value)) : commands; });
function run(path: string) { open.value = false; router.push(path); }
watch(open, async (value) => { if (value) { query.value = ''; await nextTick(); input.value?.focus(); } });
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="command-overlay" />
      <DialogContent class="command-palette" :aria-describedby="undefined">
        <DialogTitle class="sr-only">命令面板</DialogTitle>
        <label class="command-search">
          <span class="command-search__icon"><n-icon :component="SearchOutline" size="19" /></span>
          <span class="command-search__copy">
            <small>快速导航</small>
            <input ref="input" v-model="query" placeholder="搜索页面或命令…" @keydown.enter="filtered[0] && run(filtered[0].path)">
          </span>
          <kbd>ESC</kbd>
        </label>
        <div class="command-list">
          <p>页面导航 <span>{{ filtered.length }} 项</span></p>
          <button v-for="item in filtered" :key="item.path" type="button" @click="run(item.path)">
            <span class="command-item__icon"><n-icon :component="item.icon" size="18" /></span>
            <span class="command-item__copy"><b>{{ item.label }}</b><small>{{ item.hint }}</small></span>
            <kbd>↵</kbd>
          </button>
          <div v-if="!filtered.length" class="command-empty"><b>没有匹配的命令</b><span>尝试输入页面名称或功能关键词</span></div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.command-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: var(--color-dialog-scrim);
  backdrop-filter: blur(10px) saturate(110%);
  -webkit-backdrop-filter: blur(10px) saturate(110%);
}

.command-overlay[data-state='open'] { animation: command-overlay-in var(--dur-base) var(--ease-out); }
.command-overlay[data-state='closed'] { animation: command-overlay-out var(--dur-fast) var(--ease-in); }

.command-palette {
  position: fixed;
  top: min(13vh, 7rem);
  left: 50%;
  z-index: 91;
  display: grid;
  width: min(46rem, calc(100vw - 4rem));
  max-height: min(42rem, calc(100dvh - 8rem));
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--color-rule-strong);
  border-radius: 1.15rem;
  background: var(--color-paper-raised);
  background: color-mix(in srgb, var(--color-paper-raised) 88%, transparent);
  box-shadow: 0 2.25rem 6rem rgba(12, 13, 18, .24), 0 .3rem 1.2rem rgba(12, 13, 18, .12), inset 0 1px 0 rgba(255, 255, 255, .24);
  outline: none;
  transform: translateX(-50%);
  backdrop-filter: blur(48px) saturate(180%);
  -webkit-backdrop-filter: blur(48px) saturate(180%);
  will-change: transform, opacity, filter;
}

.command-palette[data-state='open'] { animation: command-panel-in var(--dur-slow) var(--ease-out); }
.command-palette[data-state='closed'] { animation: command-panel-out var(--dur-fast) var(--ease-in); }

.command-search {
  display: grid;
  min-height: 4.75rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: .9rem;
  border-bottom: 1px solid var(--color-rule);
  padding: .65rem 1rem .65rem 1.1rem;
  color: var(--color-muted);
}

.command-search__icon {
  display: grid;
  width: 2.45rem;
  height: 2.45rem;
  place-items: center;
  border: 1px solid var(--color-rule);
  border-radius: .72rem;
  background: var(--color-paper-2);
  color: var(--color-accent);
  box-shadow: var(--shadow-xs);
}

.command-search__copy { display: grid; gap: .12rem; }
.command-search__copy small { color: var(--color-faint); font-size: .75rem; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
.command-search input { min-width: 0; border: 0; outline: 0; background: transparent; color: var(--color-ink); font-family: var(--font-body); font-size: 1rem; line-height: 1.45; }
.command-search input::placeholder { color: var(--color-muted); opacity: .86; }

.command-search kbd,
.command-list kbd {
  border: 1px solid var(--color-rule-strong);
  border-radius: .42rem;
  background: var(--color-paper-2);
  padding: .2rem .42rem;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: .75rem;
  line-height: 1.2;
  box-shadow: inset 0 -1px 0 var(--color-rule);
}

.command-list { display: grid; gap: .25rem; overflow: auto; padding: .8rem; }
.command-list > p { display: flex; align-items: center; justify-content: space-between; margin: .35rem .65rem .45rem; color: var(--color-faint); font-size: .75rem; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
.command-list > p span { font-family: var(--font-mono); font-weight: 500; letter-spacing: 0; }
.command-list button { display: grid; min-height: 3.8rem; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .85rem; border: 1px solid transparent; border-radius: .78rem; background: transparent; padding: .55rem .7rem; color: var(--color-muted); text-align: left; outline: 0; transition: border-color var(--dur-instant), background var(--dur-instant), box-shadow var(--dur-instant), transform var(--dur-instant); }
.command-list button:hover,
.command-list button:focus-visible { border-color: color-mix(in srgb, var(--color-accent) 22%, var(--color-rule)); background: var(--color-accent-soft); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .18); transform: translateY(-1px); }

.command-item__icon { display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border: 1px solid var(--color-rule); border-radius: .65rem; background: var(--color-paper-2); color: var(--color-muted); transition: border-color var(--dur-instant), background var(--dur-instant), color var(--dur-instant); }
.command-list button:hover .command-item__icon,
.command-list button:focus-visible .command-item__icon { border-color: color-mix(in srgb, var(--color-accent) 28%, var(--color-rule)); background: var(--color-paper-raised); color: var(--color-accent); }
.command-item__copy b,
.command-item__copy small { display: block; }
.command-item__copy b { color: var(--color-ink); font-size: .9rem; font-weight: 620; }
.command-item__copy small { margin-top: .14rem; color: var(--color-muted); font-size: .78rem; }
.command-empty { display: grid; justify-items: center; gap: .35rem; padding: 3rem 2rem; color: var(--color-muted); text-align: center; }
.command-empty b { color: var(--color-ink-2); font-size: .9rem; }
.command-empty span { font-size: .8rem; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }

@keyframes command-overlay-in { from { opacity: 0; } }
@keyframes command-overlay-out { to { opacity: 0; } }
@keyframes command-panel-in { from { opacity: 0; filter: blur(5px); transform: translate(-50%, -.8rem) scale(.975); } }
@keyframes command-panel-out { to { opacity: 0; filter: blur(3px); transform: translate(-50%, -.35rem) scale(.985); } }

@media (prefers-reduced-motion: reduce) {
  .command-overlay,
  .command-palette { animation-duration: 1ms !important; }
}
</style>
