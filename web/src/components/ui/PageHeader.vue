<script setup lang="ts">
defineProps<{
  eyebrow?: string;
  title: string;
  summary?: string;
  count?: number | string;
}>();
</script>

<template>
  <header class="page-header">
    <div class="page-heading">
      <h1 class="page-title">{{ title }}<span v-if="count !== undefined" class="page-count">{{ count }}</span></h1>
      <p v-if="summary" class="page-summary">{{ summary }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-header { display:flex;align-items:flex-start;justify-content:space-between;gap:1.5rem; }
.page-header__actions { display:flex;flex:none;align-items:center;gap:.5rem; }
.page-title { margin:0;color:var(--color-ink);font-size:var(--text-2xl);font-weight:700;letter-spacing:-.03em;line-height:1.2; }
.page-count { margin-left:.5rem;color:var(--color-faint);font-size:var(--text-sm);font-weight:500;font-family:var(--font-mono);letter-spacing:0; }
.page-summary { margin:.25rem 0 0;color:var(--color-muted);font-size:var(--text-sm); }
</style>
