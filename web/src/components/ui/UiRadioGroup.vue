<script setup lang="ts">
import { RadioGroupRoot, RadioGroupItem } from 'reka-ui';

const model = defineModel<string>();

withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});
</script>

<template>
  <RadioGroupRoot v-model="model" class="ui-radio-group" :disabled="disabled">
    <slot />
  </RadioGroupRoot>
</template>

<style scoped>
.ui-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>
