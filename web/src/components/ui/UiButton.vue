<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  block?: boolean;
  disabled?: boolean;
}>(), {
  variant: 'secondary',
  size: 'md',
  loading: false,
  block: false,
  disabled: false,
});
</script>

<template>
  <button
    type="button"
    :class="['ui-button', `ui-button--${variant}`, `ui-button--${size}`, block && 'ui-button--block']"
    :aria-busy="loading"
    :disabled="loading || disabled"
  >
    <span v-if="loading" class="ui-button__spinner" aria-hidden="true" />
    <span v-else-if="$slots.icon" class="ui-button__icon"><slot name="icon" /></span>
    <span class="ui-button__label"><slot /></span>
  </button>
</template>

<style scoped>
.ui-button { display:inline-flex;min-width:0;align-items:center;justify-content:center;gap:.5rem;border:1px solid transparent;border-radius:var(--radius-sm);padding:0 .85rem;font-family:var(--font-body);font-size:.875rem;font-weight:620;line-height:1;white-space:nowrap;box-shadow:var(--shadow-xs);transition:transform var(--dur-instant) var(--ease-out),border-color var(--dur-fast),background-color var(--dur-fast),color var(--dur-fast),box-shadow var(--dur-fast); }
.ui-button--sm { min-height:2rem; font-size: var(--text-sm);padding:4px 8px;}.ui-button--md { min-height:2.6rem; }.ui-button--block { width:100%; }
.ui-button--secondary { border-color:var(--color-rule-strong);background:var(--color-paper-raised);color:var(--color-ink-2); }.ui-button--secondary:hover { border-color:color-mix(in srgb,var(--color-accent) 28%,var(--color-rule-strong));background:var(--color-paper);color:var(--color-ink);box-shadow:var(--shadow-sm); }
.ui-button--primary { border-color:var(--color-accent);background:var(--color-accent);color:var(--color-accent-ink);box-shadow:0 5px 15px color-mix(in srgb,var(--color-accent) 22%,transparent); }.ui-button--primary:hover { border-color:var(--color-accent-hover);background:var(--color-accent-hover);box-shadow:0 7px 20px color-mix(in srgb,var(--color-accent) 30%,transparent); }
.ui-button--ghost { border-color:transparent;background:transparent;color:var(--color-muted);box-shadow:none; }.ui-button--ghost:hover { background:var(--color-paper-3);color:var(--color-ink); }
.ui-button--danger { border-color:color-mix(in srgb,var(--color-danger) 28%,var(--color-rule));background:var(--color-danger-soft);color:var(--color-danger);box-shadow:none; }.ui-button--danger:hover { border-color:color-mix(in srgb,var(--color-danger) 48%,var(--color-rule));background:color-mix(in srgb,var(--color-danger) 15%,var(--color-paper)); }
.ui-button:active:not(:disabled) { transform:scale(.975); }.ui-button:disabled { opacity:.46;cursor:default;box-shadow:none; }
.ui-button__icon { display:grid;place-items:center;font-size:1rem; }.ui-button__spinner { width:.9rem;height:.9rem;border:2px solid currentColor;border-right-color:transparent;border-radius:999px;animation:ui-spin .65s linear infinite; }
@keyframes ui-spin { to { transform:rotate(360deg); } }
</style>
