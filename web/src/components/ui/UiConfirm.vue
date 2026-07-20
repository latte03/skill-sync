<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'reka-ui';

withDefaults(defineProps<{
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}>(), {
  title: '确认操作',
  description: '',
  confirmText: '确认',
  cancelText: '取消',
  variant: 'default',
});

const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <AlertDialogRoot>
    <AlertDialogTrigger as-child>
      <slot name="trigger" />
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay class="ui-confirm-overlay" />
      <AlertDialogContent class="ui-confirm-content">
        <AlertDialogTitle class="ui-confirm-title">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="description" class="ui-confirm-desc">
          {{ description }}
        </AlertDialogDescription>
        <div class="ui-confirm-actions">
          <AlertDialogCancel class="ui-confirm-btn ui-confirm-btn--cancel">
            {{ cancelText }}
          </AlertDialogCancel>
          <AlertDialogAction
            class="ui-confirm-btn"
            :class="variant === 'danger' ? 'ui-confirm-btn--danger' : 'ui-confirm-btn--primary'"
            @click="emit('confirm')"
          >
            {{ confirmText }}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style>
.ui-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, .32);
  animation: ui-confirm-fade 120ms var(--ease-out);
}

.ui-confirm-content {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 9999;
  transform: translate(-50%, -50%);
  width: min(20rem, calc(100vw - 2rem));
  border: 1px solid var(--color-rule-strong);
  border-radius: var(--radius-md);
  background: var(--color-paper-raised);
  box-shadow: var(--shadow-lg);
  padding: 1.25rem;
  animation: ui-confirm-in 140ms var(--ease-out);
}

.ui-confirm-title {
  margin: 0;
  color: var(--color-ink);
  font-size: var(--text-base);
  font-weight: 650;
}

.ui-confirm-desc {
  margin: .375rem 0 0;
  color: var(--color-muted);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.ui-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: .5rem;
  margin-top: 1rem;
}

.ui-confirm-btn {
  border: 1px solid var(--color-rule-strong);
  border-radius: var(--radius-xs);
  padding: .35rem .75rem;
  font-size: var(--text-xs);
  font-weight: 550;
  cursor: pointer;
  transition: background var(--dur-fast), border-color var(--dur-fast);
}

.ui-confirm-btn--cancel {
  background: var(--color-paper);
  color: var(--color-ink-2);
}
.ui-confirm-btn--cancel:hover {
  background: var(--color-paper-2);
}

.ui-confirm-btn--primary {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: #fff;
}
.ui-confirm-btn--primary:hover {
  opacity: .9;
}

.ui-confirm-btn--danger {
  border-color: var(--color-danger);
  background: var(--color-danger);
  color: #fff;
}
.ui-confirm-btn--danger:hover {
  opacity: .9;
}

@keyframes ui-confirm-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ui-confirm-in { from { opacity: 0; transform: translate(-50%, -50%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
</style>
