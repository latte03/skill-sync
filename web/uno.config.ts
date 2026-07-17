import { defineConfig, presetIcons, presetTypography } from 'unocss';
import presetWind3 from '@unocss/preset-wind3';

export default defineConfig({
  presets: [
    presetWind3({ preflight: false }),
    presetIcons({ scale: 1.2 }),
    presetTypography(),
  ],
  // Shared console primitives. Views still use Wind/Tailwind utilities for their
  // own composition; these keep the semantic, token-bound parts consistent.
  shortcuts: {
    'app-page': 'grid w-full max-w-[var(--content-max-width)] mx-auto gap-6 px-9 py-8 pb-16',
    'page-heading': 'grid min-w-0 gap-2',
    'page-kicker': 'm-0 text-[0.7rem] leading-none font-[var(--font-mono)] font-600 tracking-[0.12em] uppercase text-[var(--color-muted)]',
    'page-title': 'm-0 font-[var(--font-display)] text-[clamp(1.75rem_2.4vw_2.2rem)] leading-[1.05] font-650 tracking-[-0.045em] text-[var(--color-ink)]',
    'page-summary': 'max-w-[62ch] m-0 text-sm leading-6 text-[var(--color-muted)]',
    'page-toolbar': 'flex flex-wrap items-center gap-3',
    'action-row': 'flex flex-wrap items-center gap-3',
    'inline-actions': 'flex flex-wrap items-center gap-3',
    'surface': 'border border-[var(--color-rule)] rounded-[var(--radius-lg)] bg-[var(--color-paper)] shadow-[var(--shadow-sm)]',
    'surface--muted': 'bg-[var(--color-paper-2)]',
    'metric-label': 'm-0 text-[0.6875rem] leading-none font-[var(--font-mono)] font-600 tracking-[0.1em] uppercase text-[var(--color-muted)]',
    'meta-label': 'm-0 text-[0.6875rem] leading-none font-[var(--font-mono)] font-600 tracking-[0.1em] uppercase text-[var(--color-muted)]',
    'mono': 'font-[var(--font-mono)]',
    'state-success': 'text-[var(--color-success)]',
    'state-warning': 'text-[var(--color-warning)]',
    'state-danger': 'text-[var(--color-danger)]',
  },
  theme: {
    colors: {
      paper: 'var(--color-paper)',
      canvas: 'var(--color-paper-2)',
      ink: 'var(--color-ink)',
      muted: 'var(--color-muted)',
      rule: 'var(--color-rule)',
      accent: 'var(--color-accent)',
      graphite: 'var(--color-graphite)',
    },
  },
});
