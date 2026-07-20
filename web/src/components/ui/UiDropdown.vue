<script setup lang="ts">
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'reka-ui';

export type UiDropdownOption = {
  label: string;
  key: string;
  disabled?: boolean;
  separator?: boolean;
};

defineProps<{
  options: UiDropdownOption[];
}>();

const emit = defineEmits<{
  select: [key: string];
}>();
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="ui-dropdown-content" :side-offset="6" :collision-padding="12" align="start">
        <template v-for="option in options" :key="option.key">
          <DropdownMenuSeparator v-if="option.separator" class="ui-dropdown-separator" />
          <DropdownMenuItem
            v-else
            class="ui-dropdown-item"
            :disabled="option.disabled"
            @select="emit('select', option.key)"
          >
            {{ option.label }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style>
.ui-dropdown-content {
  z-index: 110;
  min-width: 10rem;
  overflow: hidden;
  border: 1px solid var(--color-rule-strong);
  border-radius: var(--radius-md);
  background: var(--color-glass-strong);
  padding: 0.32rem;
  box-shadow: var(--shadow-lg);
  outline: 0;
  backdrop-filter: saturate(180%) blur(42px);
  -webkit-backdrop-filter: saturate(180%) blur(42px);
}

.ui-dropdown-content[data-state='open'] {
  animation: ui-dropdown-in var(--dur-base) var(--ease-out);
}

.ui-dropdown-content[data-state='closed'] {
  animation: ui-dropdown-out var(--dur-fast) var(--ease-in);
}

.ui-dropdown-item {
  display: flex;
  min-height: 2.2rem;
  align-items: center;
  border-radius: var(--radius-sm);
  padding: 0 0.7rem;
  color: var(--color-ink-2);
  font-size: var(--text-sm);
  outline: 0;
  cursor: default;
  user-select: none;
  transition: background-color var(--dur-instant), color var(--dur-instant);
}

.ui-dropdown-item[data-highlighted] {
  background: var(--color-accent-soft);
  color: var(--color-ink);
}

.ui-dropdown-item[data-disabled] {
  opacity: 0.42;
}

.ui-dropdown-separator {
  height: 1px;
  margin: 0.25rem 0.5rem;
  background: var(--color-rule);
}

@keyframes ui-dropdown-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes ui-dropdown-out {
  to { opacity: 0; transform: translateY(-2px) scale(0.985); }
}
</style>
