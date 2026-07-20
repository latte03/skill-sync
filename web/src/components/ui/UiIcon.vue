<script setup lang="ts">
import { computed, type Component } from 'vue';

const props = withDefaults(defineProps<{
  component: Component;
  size?: number | string;
}>(), {
  size: 16,
});

const sizeStyle = computed(() => {
  const value = typeof props.size === 'number' ? `${props.size}px` : props.size;
  return { width: value, height: value };
});
</script>

<template>
  <component
    :is="component"
    class="ui-icon"
    :style="sizeStyle"
    aria-hidden="true"
  />
</template>

<style scoped>
.ui-icon {
  display: inline-block;
  flex: none;
  vertical-align: middle;
  fill: currentColor;
  stroke: currentColor;
}
</style>
