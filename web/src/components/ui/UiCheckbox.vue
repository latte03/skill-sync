<script setup lang="ts">
import { CheckboxRoot, CheckboxIndicator } from 'reka-ui';

const model = defineModel<boolean | 'indeterminate'>({ default: undefined });

withDefaults(defineProps<{
  value?: string;
  disabled?: boolean;
}>(), {
  disabled: false,
});
</script>

<template>
  <label class="ui-checkbox">
    <CheckboxRoot v-model:checked="model" class="ui-checkbox__control" :value="value" :disabled="disabled">
      <CheckboxIndicator class="ui-checkbox__indicator">
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 6.5L5 9l4.5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </CheckboxIndicator>
    </CheckboxRoot>
    <span class="ui-checkbox__label"><slot /></span>
  </label>
</template>

<style scoped>
.ui-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  user-select: none;
}

.ui-checkbox__control {
  display: grid;
  place-items: center;
  width: 1.05rem;
  height: 1.05rem;
  flex: none;
  border: 1.5px solid var(--color-rule-strong);
  border-radius: var(--radius-xs);
  background: var(--color-paper);
  outline: none;
  transition: border-color var(--dur-fast), background-color var(--dur-fast), box-shadow var(--dur-fast);
}

.ui-checkbox__control:hover {
  border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-rule-strong));
}

.ui-checkbox__control:focus-visible {
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.ui-checkbox__control[data-state='checked'] {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.ui-checkbox__indicator {
  display: grid;
  place-items: center;
  color: var(--color-accent-ink);
}

.ui-checkbox__indicator svg {
  width: 0.7rem;
  height: 0.7rem;
}

.ui-checkbox__label {
  color: var(--color-ink-2);
  font-size: var(--text-sm);
  line-height: 1.2;
}

.ui-checkbox:has(.ui-checkbox__control:disabled) {
  opacity: 0.45;
  cursor: default;
}
</style>
