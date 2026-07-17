<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  summary: string;
  count?: number | string;
}>();
</script>

<template>
  <header class="page-header">
    <div class="page-heading">
      <p class="page-kicker">{{ eyebrow }}</p>
      <h1 class="page-title">{{ title }} <span v-if="count !== undefined" class="page-count">{{ count }}</span></h1>
      <p class="page-summary">{{ summary }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-header { display:flex;min-height:5.35rem;align-items:flex-end;justify-content:space-between;gap:2rem; }
.page-header__actions { display:flex;flex:none;align-items:center;gap:.65rem; }
.page-count { display:inline-grid;min-width:1.75rem;height:1.75rem;margin-left:.5rem;place-items:center;border:1px solid var(--color-rule-strong);border-radius:.55rem;background:var(--color-paper-2);padding:0 .4rem;color:var(--color-muted);font-family:var(--font-mono);font-size:.75rem;font-weight:600;letter-spacing:0;vertical-align:.25rem; }
</style>
