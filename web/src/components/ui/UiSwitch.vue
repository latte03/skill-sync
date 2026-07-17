<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui';

const model = defineModel<boolean>({ default: false });

withDefaults(defineProps<{
  ariaLabel?: string;
  disabled?: boolean;
}>(), {
  ariaLabel: '切换设置',
  disabled: false,
});
</script>

<template>
  <SwitchRoot
    v-model="model"
    class="ui-switch"
    :aria-label="ariaLabel"
    :disabled="disabled"
  >
    <SwitchThumb class="ui-switch__thumb" />
  </SwitchRoot>
</template>

<style scoped>
.ui-switch {
  position: relative;
  display: inline-flex;
  width: 2.65rem;
  height: 1.5rem;
  flex: none;
  align-items: center;
  border: 1px solid var(--color-rule-strong);
  border-radius: 999px;
  background: var(--color-paper-3);
  padding: .14rem;
  outline: none;
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--color-ink) 10%, transparent);
  cursor: pointer;
  transition: border-color var(--dur-fast), background-color var(--dur-fast), box-shadow var(--dur-fast);
}

.ui-switch:hover {
  border-color: color-mix(in srgb, var(--color-accent) 38%, var(--color-rule-strong));
}

.ui-switch[data-state="checked"] {
  border-color: var(--color-accent);
  background: var(--color-accent);
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--color-ink) 12%, transparent), 0 0 0 1px color-mix(in srgb, var(--color-accent) 12%, transparent);
}

.ui-switch:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 20%, transparent);
}

.ui-switch:disabled {
  opacity: .45;
  cursor: default;
}

.ui-switch__thumb {
  display: block;
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 999px;
  background: var(--color-paper-raised);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--color-ink) 24%, transparent);
  transform: translateX(0);
  transition: transform 180ms var(--ease-out), background-color var(--dur-fast);
  will-change: transform;
}

.ui-switch__thumb[data-state="checked"] {
  transform: translateX(1.1rem);
}

@media (prefers-reduced-motion: reduce) {
  .ui-switch,
  .ui-switch__thumb {
    transition-duration: 1ms;
  }
}
</style>
