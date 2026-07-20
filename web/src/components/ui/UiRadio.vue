<script setup lang="ts">
import { RadioGroupItem, RadioGroupIndicator } from 'reka-ui';

defineProps<{
  value: string;
  disabled?: boolean;
}>();
</script>

<template>
  <label class="ui-radio">
    <RadioGroupItem class="ui-radio__control" :value="value" :disabled="disabled">
      <RadioGroupIndicator class="ui-radio__dot" />
    </RadioGroupItem>
    <span class="ui-radio__label"><slot /></span>
  </label>
</template>

<style scoped>
.ui-radio {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  user-select: none;
}

.ui-radio__control {
  display: grid;
  place-items: center;
  width: 1.05rem;
  height: 1.05rem;
  flex: none;
  border: 1.5px solid var(--color-rule-strong);
  border-radius: 999px;
  background: var(--color-paper);
  outline: none;
  transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
}

.ui-radio__control:hover {
  border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-rule-strong));
}

.ui-radio__control:focus-visible {
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.ui-radio__control[data-state='checked'] {
  border-color: var(--color-accent);
}

.ui-radio__dot {
  display: block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--color-accent);
}

.ui-radio__label {
  color: var(--color-ink-2);
  font-size: var(--text-sm);
  line-height: 1;
}

.ui-radio:has(.ui-radio__control:disabled) {
  opacity: 0.45;
  cursor: default;
}
</style>
