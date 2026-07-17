<script setup lang="ts">
import { CloseOutline } from '@vicons/ionicons5';
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';

const open = defineModel<boolean>({ required: true });
withDefaults(defineProps<{ title: string; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' });
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="ui-dialog-overlay" />
      <DialogContent :class="['ui-dialog', `ui-dialog--${size}`]">
        <header class="ui-dialog__header">
          <DialogTitle class="ui-dialog__title">{{ title }}</DialogTitle>
          <DialogClose class="ui-dialog__close" aria-label="关闭"><n-icon :component="CloseOutline" size="18" /></DialogClose>
        </header>
        <div class="ui-dialog__body"><slot /></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.ui-dialog-overlay { position:fixed;inset:0;z-index:100;background:var(--color-dialog-scrim); }.ui-dialog-overlay[data-state='open'] { animation:ui-overlay-in var(--dur-base) ease-out; }.ui-dialog-overlay[data-state='closed'] { animation:ui-overlay-out var(--dur-fast) ease-in; }
.ui-dialog { position:fixed;top:50%;left:50%;z-index:101;display:grid;width:calc(100vw - 6rem);max-height:calc(100dvh - 6rem);grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid var(--color-rule-strong);border-radius:1.05rem;background:var(--color-glass-strong);color:var(--color-ink-2);box-shadow:var(--shadow-lg);outline:0;transform:translate(-50%,-50%);backdrop-filter:saturate(185%) blur(44px);-webkit-backdrop-filter:saturate(185%) blur(44px);will-change:transform,opacity,filter; }.ui-dialog--sm { max-width:34rem; }.ui-dialog--md { max-width:40rem; }.ui-dialog--lg { max-width:46rem; }.ui-dialog[data-state='open'] { animation:ui-dialog-in var(--dur-slow) var(--ease-out); }.ui-dialog[data-state='closed'] { animation:ui-dialog-out var(--dur-fast) var(--ease-in); }
.ui-dialog__header { display:flex;min-height:4.25rem;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--color-rule);padding:0 1.35rem; }.ui-dialog__title { margin:0;color:var(--color-ink);font-family:var(--font-display);font-size:1.05rem;font-weight:680;letter-spacing:-.025em; }.ui-dialog__close { display:grid;width:2.25rem;height:2.25rem;place-items:center;border:0;border-radius:.6rem;background:var(--color-paper-2);color:var(--color-muted);transition:background var(--dur-fast),color var(--dur-fast),transform var(--dur-instant); }.ui-dialog__close:hover { background:var(--color-paper-3);color:var(--color-ink); }.ui-dialog__close:active { transform:scale(.94); }.ui-dialog__body { min-height:0;overflow:auto;padding:1.35rem; }
@keyframes ui-overlay-in { from { opacity:0; } } @keyframes ui-overlay-out { to { opacity:0; } }
@keyframes ui-dialog-in { from { opacity:0;transform:translate(-50%,calc(-50% + 12px)) scale(.965);filter:blur(5px); } to { opacity:1;transform:translate(-50%,-50%) scale(1);filter:blur(0); } }
@keyframes ui-dialog-out { from { opacity:1;transform:translate(-50%,-50%) scale(1); } to { opacity:0;transform:translate(-50%,calc(-50% + 6px)) scale(.985); } }
</style>
