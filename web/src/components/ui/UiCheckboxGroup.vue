<script setup lang="ts">
import { CheckboxGroupRoot } from 'reka-ui';

const model = defineModel<string[]>({ default: () => [] });

withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});
</script>

<template>
  <CheckboxGroupRoot v-model="model" class="ui-checkbox-group" :disabled="disabled">
    <slot />
  </CheckboxGroupRoot>
</template>

<style scoped>
.ui-checkbox-group {
  display: grid;
  gap: 0.5rem;
}
</style>
