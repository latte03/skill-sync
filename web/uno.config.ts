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
  // 自定义快捷类 — macOS Tahoe 风格
  shortcuts: {
    'glass-card': 'bg-white/60 backdrop-blur-xl saturate-150 border border-white/60 rounded-2xl shadow-sm',
    'glass-card-hover': 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-150',
    'section-title': 'text-base font-semibold text-[#1d1d1f] tracking-tight',
    'section-desc': 'text-sm text-[#86868b]',
  },
  theme: {
    colors: {
      // Apple System Colors
      'apple-blue': '#007AFF',
      'apple-green': '#34C759',
      'apple-orange': '#FF9500',
      'apple-red': '#FF3B30',
      'apple-purple': '#AF52DE',
      'apple-gray': '#86868b',
      'apple-dark': '#1d1d1f',
    },
  },
});
