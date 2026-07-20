<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui';

withDefaults(defineProps<{
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  delay?: number;
}>(), {
  side: 'top',
  align: 'center',
  delay: 300,
});
</script>

<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot name="trigger" />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          class="ui-tooltip-content"
          :side="side"
          :align="align"
          :side-offset="6"
        >
          <slot />
          <TooltipArrow class="ui-tooltip-arrow" :width="10" :height="5" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<style>
.ui-tooltip-content {
  z-index: 9999;
  max-width: 16rem;
  border: 1px solid var(--color-rule-strong);
  border-radius: var(--radius-sm);
  background: var(--color-paper-raised);
  box-shadow: var(--shadow-md);
  padding: .5rem .625rem;
  color: var(--color-ink);
  font-size: var(--text-xs);
  line-height: 1.45;
  animation: ui-tooltip-in 120ms var(--ease-out);
}

.ui-tooltip-content[data-state="delayed-open"] {
  animation: ui-tooltip-in 120ms var(--ease-out);
}

.ui-tooltip-arrow {
  fill: var(--color-paper-raised);
}

@keyframes ui-tooltip-in {
  from { opacity: 0; transform: scale(.96) translateY(2px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
