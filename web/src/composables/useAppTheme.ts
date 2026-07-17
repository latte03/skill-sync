import { onMounted, onUnmounted, shallowRef, watch } from 'vue';

export type AppTheme = 'light' | 'dark';
const storageKey = 'skillsync-theme';

export function useAppTheme() {
  const theme = shallowRef<AppTheme>('light');
  let mediaQuery: MediaQueryList | undefined;
  function applyStoredOrSystem() { const stored = localStorage.getItem(storageKey); theme.value = stored === 'light' || stored === 'dark' ? stored : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function onSystemThemeChange(event: MediaQueryListEvent) { if (localStorage.getItem(storageKey) === null) theme.value = event.matches ? 'dark' : 'light'; }
  function toggleTheme() { theme.value = theme.value === 'dark' ? 'light' : 'dark'; localStorage.setItem(storageKey, theme.value); }
  watch(theme, value => { document.documentElement.dataset.theme = value; }, { immediate: true });
  onMounted(() => { applyStoredOrSystem(); mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)'); mediaQuery?.addEventListener('change', onSystemThemeChange); });
  onUnmounted(() => mediaQuery?.removeEventListener('change', onSystemThemeChange));
  return { theme, toggleTheme };
}
