<script setup lang="ts">
import type { Component } from 'vue';
import { GlobeOutline, KeyOutline, SparklesOutline } from '@vicons/ionicons5';
import UiIcon from '../ui/UiIcon.vue';

type SettingsSectionKey = 'git' | 'proxy' | 'ai';

const props = defineProps<{
  active: SettingsSectionKey;
  gitStatus: string;
  proxyStatus: string;
  aiStatus: string;
}>();

const emit = defineEmits<{
  select: [section: SettingsSectionKey];
}>();

const items: Array<{
  key: SettingsSectionKey;
  label: string;
  description: string;
  icon: Component;
}> = [
  { key: 'git', label: 'Git 平台', description: '凭证与远程访问', icon: KeyOutline },
  { key: 'proxy', label: '网络代理', description: '请求连接方式', icon: GlobeOutline },
  { key: 'ai', label: 'AI Commit', description: '模型服务与密钥', icon: SparklesOutline },
];

function statusFor(section: SettingsSectionKey) {
  if (section === 'git') return props.gitStatus;
  if (section === 'proxy') return props.proxyStatus;
  return props.aiStatus;
}
</script>

<template>
  <nav class="settings-nav" aria-label="设置分类">
    <p>设置分类</p>
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      :class="{ active: active === item.key }"
      :aria-current="active === item.key ? 'page' : undefined"
      @click="emit('select', item.key)"
    >
      <span class="settings-nav__icon"><UiIcon :component="item.icon" size="17" /></span>
      <span class="settings-nav__copy">
        <b>{{ item.label }}</b>
        <small>{{ item.description }}</small>
        <em>{{ statusFor(item.key) }}</em>
      </span>
    </button>
  </nav>
</template>

<style scoped>
.settings-nav { display:grid;align-content:start;gap:.35rem; }
.settings-nav>p { margin:0 0 .35rem;padding:0 .75rem;color:var(--color-faint);font-family:var(--font-mono);font-size:.75rem;font-weight:650;letter-spacing:.08em; }
.settings-nav>button { display:grid;grid-template-columns:2.35rem minmax(0,1fr);align-items:start;gap:.75rem;border:1px solid transparent;border-radius:var(--radius-xl);background:transparent;padding:.8rem .75rem;color:var(--color-muted);text-align:left;transition:border-color var(--dur-fast),background-color var(--dur-fast),color var(--dur-fast),transform var(--dur-instant) var(--ease-out); }
.settings-nav>button:hover { background:var(--color-paper-2);color:var(--color-ink-2); }
.settings-nav>button:active { transform:scale(.985); }
.settings-nav>button:focus-visible { outline:3px solid color-mix(in srgb,var(--color-accent) 18%,transparent);outline-offset:1px; }
.settings-nav>button.active { border-color:color-mix(in srgb,var(--color-accent) 25%,var(--color-rule));background:var(--color-accent-soft);color:var(--color-accent); }
.settings-nav__icon { display:grid;width:2.35rem;height:2.35rem;place-items:center;border:1px solid var(--color-rule);border-radius:var(--radius-lg);background:var(--color-paper);color:currentColor; }
.settings-nav__copy,.settings-nav__copy b,.settings-nav__copy small,.settings-nav__copy em { display:block;min-width:0; }
.settings-nav__copy b { color:var(--color-ink);font-size:.9rem;line-height:1.25; }
.settings-nav__copy small { margin-top:.18rem;color:var(--color-muted);font-size:.75rem;line-height:1.3; }
.settings-nav__copy em { margin-top:.42rem;overflow:hidden;color:currentColor;font-size:.75rem;font-style:normal;line-height:1.25;text-overflow:ellipsis;white-space:nowrap; }

@media (prefers-reduced-motion: reduce) {
  .settings-nav>button { transition-duration:1ms; }
}
</style>
