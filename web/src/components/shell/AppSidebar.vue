<script setup lang="ts">
import { computed, markRaw } from 'vue';
import { useRoute } from 'vue-router';
import { AppsOutline, CloudOutline, FlashOutline, GitBranchOutline, MoonOutline, OptionsOutline, SearchOutline, ShieldCheckmarkOutline, SunnyOutline, WarningOutline } from '@vicons/ionicons5';
import type { AppTheme } from '../../composables/useAppTheme';

const props = defineProps<{ theme: AppTheme; open: boolean }>();
const emit = defineEmits<{ toggleTheme: []; close: [] }>();
const route = useRoute();
const groups = [
  { label: '技能库', items: [{ key: 'skills', label: '技能总览', path: '/skills', icon: markRaw(AppsOutline) }, { key: 'search', label: '发现与安装', path: '/search', icon: markRaw(SearchOutline) }] },
  { label: '分发', items: [{ key: 'manage', label: '分发控制台', path: '/manage', icon: markRaw(FlashOutline) }, { key: 'conflicts', label: '一致性检查', path: '/conflicts', icon: markRaw(WarningOutline) }] },
  { label: '同步与系统', items: [{ key: 'sync', label: '同步状态', path: '/sync', icon: markRaw(GitBranchOutline) }, { key: 'settings', label: '连接设置', path: '/settings', icon: markRaw(OptionsOutline) }, { key: 'status', label: '运行状态', path: '/status', icon: markRaw(ShieldCheckmarkOutline) }] },
];
const activeKey = computed(() => route.meta.navKey as string | undefined);
</script>

<template>
  <aside :class="['fixed z-30 inset-y-0 left-0 flex w-72 max-w-[86vw] flex-col border-r border-white/8 bg-[var(--color-graphite)] text-[var(--color-graphite-ink)] shadow-[var(--shadow-md)] transition-transform duration-180 ease-out lg:sticky lg:h-[100dvh] lg:w-64 lg:max-w-none lg:flex-none lg:translate-x-0 lg:shadow-none', props.open ? 'translate-x-0' : '-translate-x-[105%]']">
    <div class="flex min-h-22 items-center gap-3 border-b border-white/8 px-5">
      <div class="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-[0_10px_24px_color-mix(in_oklch_var(--color-accent)_32%_transparent)]" aria-hidden="true"><n-icon :component="CloudOutline" size="20" /></div>
      <div class="min-w-0"><p class="m-0 font-[var(--font-display)] text-lg leading-none font-600 tracking-[-0.05em] text-[var(--color-graphite-ink)]">SkillSync</p><p class="mt-1 mb-0 text-[0.625rem] leading-none font-[var(--font-mono)] tracking-[0.14em] text-[var(--color-muted)]">CONTROL PLANE</p></div>
      <button class="ml-auto border-0 bg-transparent text-2xl leading-none text-[var(--color-muted)] lg:hidden" type="button" aria-label="关闭导航" @click="emit('close')">×</button>
    </div>
    <nav class="grid flex-1 content-start gap-7 overflow-y-auto px-3 py-6" aria-label="主导航">
      <section v-for="group in groups" :key="group.label" class="grid gap-1">
        <p class="m-0 px-3 pb-2 text-[0.625rem] font-[var(--font-mono)] tracking-[0.12em] uppercase text-[var(--color-muted)]">{{ group.label }}</p>
        <router-link v-for="item in group.items" :key="item.key" :class="['group flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-500 no-underline transition-colors duration-150', activeKey === item.key ? 'bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-accent)]' : 'text-[var(--color-graphite-ink)]/70 hover:bg-white/6 hover:text-white']" :to="item.path" @click="emit('close')">
          <n-icon :component="item.icon" size="17" /><span>{{ item.label }}</span>
        </router-link>
      </section>
    </nav>
    <div class="grid gap-3 border-t border-white/8 p-3">
      <button class="flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] border border-white/10 bg-white/4 px-3 text-left text-sm text-[var(--color-graphite-ink)] transition-colors duration-150 hover:bg-white/9" type="button" @click="emit('toggleTheme')"><n-icon :component="props.theme === 'dark' ? SunnyOutline : MoonOutline" size="16" /><span>{{ props.theme === 'dark' ? '浅色界面' : '深色界面' }}</span></button>
      <p class="m-0 flex items-center gap-2 px-3 text-[0.625rem] font-[var(--font-mono)] tracking-[0.08em] uppercase text-[var(--color-muted)]"><span class="h-2 w-2 rounded-full bg-[var(--color-success)] shadow-[0_0_0_4px_color-mix(in_oklch_var(--color-success)_18%_transparent)]" aria-hidden="true"></span>本地服务已连接</p>
    </div>
  </aside>
</template>
