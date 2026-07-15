import { defineConfig, presetIcons, presetTypography } from 'unocss';
import presetWind3 from '@unocss/preset-wind3';

export default defineConfig({
  presets: [
    presetWind3(),
    presetIcons({
      scale: 1.2,
    }),
    presetTypography(),
  ],
  // 自定义快捷类 — devtool 风格：单 accent，扁平表面，无双屏 mesh 渐变
  shortcuts: {
    'surface-card': 'bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-[var(--shadow-sm)]',
    'surface-card-hover':
      'hover:shadow-[var(--shadow-md)] hover:border-[var(--border-strong)] hover:-translate-y-0.5 transition-all duration-150',
    'section-title': 'text-base font-semibold text-[var(--text)] tracking-tight',
    'section-desc': 'text-sm text-[var(--text-2)]',
    'page-title-row':
      'flex items-center justify-between mb-[22px]',
    'page-title': 'm-0 text-xl font-bold text-[var(--text)] tracking-[-0.015em]',
  },
  theme: {
    colors: {
      // Single accent, locked across the whole app
      accent: 'var(--accent)',
      // Semantic only — used for real state, never as decorative shower
      'state-success': 'var(--success)',
      'state-warning': 'var(--warning)',
      'state-danger': 'var(--danger)',
    },
  },
});