<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'text' | 'password' | 'number' | 'email' | 'url';
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
}>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  readonly: false,
});

const model = defineModel<string>({ default: '' });
</script>

<template>
  <input
    v-model="model"
    class="ui-input"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
  />
</template>

<style scoped>
.ui-input {
  display: block;
  width: 100%;
  min-height: 2.6rem;
  border: 1px solid var(--color-rule-strong);
  border-radius: var(--radius-sm);
  background: var(--color-paper);
  padding: 0 0.8rem;
  color: var(--color-ink);
  font-family: var(--font-body);
  font-size: 0.875rem;
  line-height: 1;
  outline: none;
  box-shadow: var(--shadow-xs);
  transition: border-color var(--dur-fast), box-shadow var(--dur-fast), background-color var(--dur-fast);
}

.ui-input::placeholder {
  color: var(--color-faint);
}

.ui-input:hover:not(:disabled):not(:focus) {
  border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-rule-strong));
  background: var(--color-paper-raised);
}

.ui-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.ui-input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ui-input:read-only:not(:disabled) {
  background: var(--color-paper-2);
}
</style>
