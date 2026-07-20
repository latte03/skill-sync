import { ref } from 'vue';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

const toasts = ref<ToastItem[]>([]);
let nextId = 0;

function push(type: ToastItem['type'], message: string) {
  const id = nextId++;
  toasts.value.push({ id, type, message });
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, 3200);
}

/** Drop-in replacement for Naive UI's useMessage */
export function useToast() {
  return {
    success: (msg: string) => push('success', msg),
    error: (msg: string) => push('error', msg),
    info: (msg: string) => push('info', msg),
  };
}

export { toasts };
