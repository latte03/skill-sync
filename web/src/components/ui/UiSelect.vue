<script setup lang="ts">
import { CheckmarkOutline, ChevronDownOutline } from '@vicons/ionicons5';
import UiIcon from './UiIcon.vue';
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui';

export type UiSelectOption = { label: string; value: string; disabled?: boolean };
const model = defineModel<string | string[] | undefined>();
withDefaults(defineProps<{
  options: UiSelectOption[];
  placeholder?: string;
  prefix?: string;
  multiple?: boolean;
  disabled?: boolean;
}>(), { placeholder: '请选择', multiple: false, disabled: false });
</script>

<template>
  <SelectRoot v-model="model" :multiple="multiple" :disabled="disabled">
    <SelectTrigger class="ui-select-trigger">
      <span v-if="prefix" class="ui-select-prefix">{{ prefix }}</span>
      <span class="ui-select-value"><SelectValue :placeholder="placeholder" /></span>
      <SelectIcon class="ui-select-icon"><UiIcon :component="ChevronDownOutline" size="15" /></SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="ui-select-content" position="popper" :body-lock="false" :side-offset="7" :collision-padding="12">
        <SelectViewport class="ui-select-viewport">
          <SelectItem v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled" class="ui-select-item">
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="ui-select-check"><UiIcon :component="CheckmarkOutline" size="15" /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style>
.ui-select-trigger { display:flex;width:100%;min-height:2.6rem;align-items:center;justify-content:space-between;gap:.55rem;border:1px solid var(--color-rule-strong);border-radius:var(--radius-sm);background:var(--color-paper);padding:0 .8rem;color:var(--color-ink);font-family:var(--font-body);font-size:.875rem;box-shadow:var(--shadow-xs);outline:0;transition:border-color var(--dur-fast),box-shadow var(--dur-fast),background var(--dur-fast); }.ui-select-trigger:hover { border-color:color-mix(in srgb,var(--color-accent) 30%,var(--color-rule-strong));background:var(--color-paper-raised); }.ui-select-trigger:focus-visible,.ui-select-trigger[data-state='open'] { border-color:var(--color-accent);box-shadow:0 0 0 3px var(--color-focus-ring); }.ui-select-trigger[data-placeholder] { color:var(--color-muted); }.ui-select-prefix { flex:none;color:var(--color-faint);font-family:var(--font-mono);font-size:.75rem;letter-spacing:.04em;text-transform:uppercase; }.ui-select-value { min-width:0;flex:1;overflow:hidden;color:var(--color-ink-2);text-align:left;text-overflow:ellipsis;white-space:nowrap; }.ui-select-icon { display:grid;flex:none;place-items:center;color:var(--color-muted);transition:transform var(--dur-fast) var(--ease-out); }.ui-select-trigger[data-state='open'] .ui-select-icon { transform:rotate(180deg); }
.ui-select-content { z-index:110;min-width:var(--reka-select-trigger-width);max-height:min(22rem,var(--reka-select-content-available-height));overflow:hidden;border:1px solid var(--color-rule-strong);border-radius:var(--radius-lg);background:var(--color-glass-strong);padding:.32rem;box-shadow:var(--shadow-lg);outline:0;transform-origin:var(--reka-select-content-transform-origin);backdrop-filter:saturate(180%) blur(42px);-webkit-backdrop-filter:saturate(180%) blur(42px);will-change:transform,opacity; }.ui-select-content[data-state='open'] { animation:ui-select-in var(--dur-base) var(--ease-out); }.ui-select-content[data-state='closed'] { animation:ui-select-out var(--dur-fast) var(--ease-in); }.ui-select-viewport { display:grid;gap:.18rem; }.ui-select-item { position:relative;display:flex;min-height:2.5rem;align-items:center;border-radius:var(--radius-sm);padding:0 2.35rem 0 .75rem;color:var(--color-ink-2);font-size:.875rem;outline:0;cursor:default;transition:background-color var(--dur-instant),color var(--dur-instant),transform var(--dur-instant); }.ui-select-item[data-highlighted] { background:var(--color-accent-soft);color:var(--color-ink);transform:translateX(2px); }.ui-select-item[data-state='checked'] { color:var(--color-accent);font-weight:620; }.ui-select-item[data-disabled] { opacity:.42; }.ui-select-check { position:absolute;right:.7rem;display:grid;place-items:center;color:var(--color-accent); }
@keyframes ui-select-in { from { opacity:0;transform:translateY(-6px) scale(.97);filter:blur(3px); } to { opacity:1;transform:translateY(0) scale(1);filter:blur(0); } }
@keyframes ui-select-out { to { opacity:0;transform:translateY(-3px) scale(.985);filter:blur(2px); } }
</style>
