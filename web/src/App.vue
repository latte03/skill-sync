<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import { darkTheme, lightTheme, zhCN, dateZhCN } from 'naive-ui';
import { MotionConfig } from 'motion-v';
import AppSidebar from './components/shell/AppSidebar.vue';
import AppTopbar from './components/shell/AppTopbar.vue';
import { useAppTheme } from './composables/useAppTheme';

const route = useRoute();
const { theme, toggleTheme } = useAppTheme();
const navigationOpen = shallowRef(false);
const routeTitle = computed(() => String(route.meta.title ?? 'SkillSync'));
const routeSubtitle = computed(() => String(route.meta.subtitle ?? '管理本地 Skill 的分发、来源与同步状态'));
const activeTheme = computed(() => theme.value === 'dark' ? darkTheme : lightTheme);

</script>

<template>
  <n-config-provider :theme="activeTheme" :locale="zhCN" :date-locale="dateZhCN" inline-theme-disabled>
    <n-global-style />
    <MotionConfig reduced-motion="user"><n-message-provider><n-dialog-provider>
      <div class="flex min-h-[100dvh] bg-[var(--color-paper-2)]">
        <AppSidebar :theme="theme" :open="navigationOpen" @toggle-theme="toggleTheme" @close="navigationOpen = false" />
        <button v-if="navigationOpen" class="fixed inset-0 z-25 border-0 bg-[color-mix(in_oklch_var(--color-graphite)_65%_transparent)] lg:hidden" type="button" aria-label="关闭导航" @click="navigationOpen = false" />
        <main class="min-w-0 flex-1 bg-[var(--color-paper-2)]">
          <AppTopbar :title="routeTitle" :subtitle="routeSubtitle" @open-menu="navigationOpen = true" />
          <router-view v-slot="{ Component }"><transition name="route"><component :is="Component" /></transition></router-view>
          <footer class="mx-4 flex flex-wrap justify-between gap-3 border-t border-[var(--color-rule)] py-4 text-[0.625rem] font-[var(--font-mono)] tracking-[0.09em] uppercase text-[var(--color-muted)] sm:mx-6"><span class="flex items-center gap-2"><i class="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />本地工作区正常</span><span>SkillSync · 安全操作从预览开始</span></footer>
        </main>
      </div>
    </n-dialog-provider></n-message-provider></MotionConfig>
  </n-config-provider>
</template>

<style>
.route-enter-active, .route-leave-active { transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }.route-enter-from { opacity: 0; transform: translateY(0.5rem); }.route-leave-to { opacity: 0; transform: translateY(-0.25rem); }
</style>
