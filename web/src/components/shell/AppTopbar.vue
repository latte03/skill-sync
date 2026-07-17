<script setup lang="ts">
import { MenuOutline } from '@vicons/ionicons5';
defineProps<{ title: string; subtitle: string }>();
defineEmits<{ openMenu: [] }>();
</script>

<template>
  <header class="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-[var(--color-rule)] bg-[color-mix(in_oklch_var(--color-paper)_88%_transparent)] px-4 backdrop-blur-xl lg:hidden">
    <button class="grid h-11 w-11 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] shadow-[var(--shadow-sm)]" type="button" aria-label="打开导航" @click="$emit('openMenu')"><n-icon :component="MenuOutline" size="20" /></button>
    <div class="min-w-0"><p class="m-0 truncate font-[var(--font-display)] text-sm font-600 tracking-[-0.03em] text-[var(--color-ink)]">{{ title }}</p><p class="m-0 truncate text-[0.625rem] font-[var(--font-mono)] tracking-[0.07em] text-[var(--color-muted)]">{{ subtitle }}</p></div>
    <p class="ml-auto flex items-center gap-1.5 text-[0.625rem] font-[var(--font-mono)] tracking-[0.08em] text-[var(--color-muted)]"><span class="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" aria-hidden="true"></span>LOCAL</p>
  </header>
</template>
