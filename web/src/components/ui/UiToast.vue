<script setup lang="ts">
import { toasts } from '../../composables/useToast';
</script>

<template>
  <Teleport to="body">
    <div class="ui-toast-stack">
      <TransitionGroup name="ui-toast">
        <div v-for="toast in toasts" :key="toast.id" class="ui-toast" :class="`ui-toast--${toast.type}`">
          {{ toast.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style>
.ui-toast-stack {
  position: fixed;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  display: grid;
  gap: .375rem;
  pointer-events: none;
}

.ui-toast {
  border: 1px solid var(--color-rule-strong);
  border-radius: var(--radius-sm);
  background: var(--color-paper-raised);
  box-shadow: var(--shadow-md);
  padding: .5rem .875rem;
  color: var(--color-ink);
  font-size: var(--text-xs);
  font-weight: 500;
  white-space: nowrap;
}

.ui-toast--success { border-color: var(--color-success); color: var(--color-success); }
.ui-toast--error { border-color: var(--color-danger); color: var(--color-danger); }

.ui-toast-enter-active { animation: ui-toast-in 160ms var(--ease-out); }
.ui-toast-leave-active { animation: ui-toast-out 120ms var(--ease-out) forwards; }

@keyframes ui-toast-in { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes ui-toast-out { to { opacity: 0; transform: translateY(-4px) scale(.97); } }
</style>
