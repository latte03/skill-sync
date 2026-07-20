<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue';
import { motion } from 'motion-v';
import UiIcon from './UiIcon.vue';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: unknown;
}

const props = withDefaults(defineProps<{
  options: SegmentedOption[];
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}>(), {
  size: 'md',
  block: false,
});

const model = defineModel<string>({ required: true });

const containerRef = ref<HTMLElement | null>(null);
const indicator = ref({ left: 0, width: 0 });

function updateIndicator() {
  const container = containerRef.value;
  if (!container) return;
  const activeBtn = container.querySelector<HTMLElement>('[data-active="true"]');
  if (!activeBtn) return;
  indicator.value = {
    left: activeBtn.offsetLeft,
    width: activeBtn.offsetWidth,
  };
}

onMounted(() => nextTick(updateIndicator));
watch(model, () => nextTick(updateIndicator));

const indicatorStyle = computed(() => ({
  left: `${indicator.value.left}px`,
  width: `${indicator.value.width}px`,
}));
</script>

<template>
  <div ref="containerRef" :class="['ui-segmented', `ui-segmented--${size}`, { 'ui-segmented--block': block }]" role="tablist">
    <motion.span
      class="ui-segmented__indicator"
      :style="indicatorStyle"
      :animate="{ left: indicator.left, width: indicator.width }"
      :transition="{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }"
      aria-hidden="true"
    />
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="tab"
      :data-active="model === option.value"
      :aria-selected="model === option.value"
      @click="model = option.value"
    >
      <UiIcon v-if="option.icon" :component="option.icon" :size="size === 'sm' ? 12 : 13" />
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.ui-segmented {
  position: relative;
  display: inline-flex;
  gap: 2px;
  border-radius: var(--radius-sm);
  background: var(--color-paper-2);
  padding: 2px;
}

.ui-segmented__indicator {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border-radius: var(--radius-xs);
  background: var(--color-paper);
  box-shadow: var(--shadow-xs);
  pointer-events: none;
}

.ui-segmented button {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--color-muted);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-out);
}
.ui-segmented button:hover { color: var(--color-ink); }
.ui-segmented button[data-active="true"] { color: var(--color-ink); }

/* Sizes */
.ui-segmented--sm button { height: 1.5rem; padding: 0 .5rem; font-size: var(--text-xs); }
.ui-segmented--md button { height: 1.75rem; padding: 0 .625rem; font-size: var(--text-xs); }
.ui-segmented--lg button { height: 2.125rem; padding: 0 .85rem; font-size: var(--text-sm); }

/* Block mode */
.ui-segmented--block { display: flex; width: 100%; }
.ui-segmented--block button { flex: 1; justify-content: center; }
</style>
