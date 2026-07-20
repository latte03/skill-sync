<script setup lang="ts">
withDefaults(defineProps<{
  show?: boolean;
  size?: 'sm' | 'md' | 'lg';
}>(), {
  show: false,
  size: 'md',
});
</script>

<template>
  <div class="ui-spin-wrapper">
    <slot />
    <Transition name="ui-spin-fade">
      <div v-if="show" class="ui-spin-overlay">
        <span class="ui-spin-indicator" :class="`ui-spin-indicator--${size}`" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ui-spin-wrapper {
  position: relative;
  min-height: 3rem;
}

.ui-spin-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  border-radius: inherit;
  background: color-mix(in srgb, var(--color-paper) 72%, transparent);
  backdrop-filter: blur(1px);
}

.ui-spin-indicator {
  border: 2px solid var(--color-rule-strong);
  border-top-color: var(--color-accent);
  border-radius: 999px;
  animation: ui-spin-rotate 0.65s linear infinite;
}

.ui-spin-indicator--sm { width: 1rem; height: 1rem; }
.ui-spin-indicator--md { width: 1.5rem; height: 1.5rem; }
.ui-spin-indicator--lg { width: 2rem; height: 2rem; border-width: 2.5px; }

@keyframes ui-spin-rotate { to { transform: rotate(360deg); } }

.ui-spin-fade-enter-active { transition: opacity var(--dur-fast) var(--ease-out); }
.ui-spin-fade-leave-active { transition: opacity var(--dur-fast) var(--ease-in); }
.ui-spin-fade-enter-from,
.ui-spin-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .ui-spin-indicator { animation-duration: 1.5s; }
}
</style>
