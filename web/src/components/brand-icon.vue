<template>
  <div
    class="inline-flex items-center justify-center shrink-0"
    :style="containerStyle"
    v-html="svgContent || fallback"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
// @lobehub/icons-static-svg — raw SVG files, imported via Vite ?raw
import deepseekSvg from '@lobehub/icons-static-svg/icons/deepseek-color.svg?raw';
import openaiSvg from '@lobehub/icons-static-svg/icons/openai.svg?raw';
import chatglmSvg from '@lobehub/icons-static-svg/icons/chatglm-color.svg?raw';
import qwenSvg from '@lobehub/icons-static-svg/icons/qwen-color.svg?raw';
import moonshotSvg from '@lobehub/icons-static-svg/icons/moonshot.svg?raw';
import minimaxSvg from '@lobehub/icons-static-svg/icons/minimax-color.svg?raw';
import baichuanSvg from '@lobehub/icons-static-svg/icons/baichuan-color.svg?raw';
import stepfunSvg from '@lobehub/icons-static-svg/icons/stepfun-color.svg?raw';
import zerooneSvg from '@lobehub/icons-static-svg/icons/zeroone-color.svg?raw';
import siliconcloudSvg from '@lobehub/icons-static-svg/icons/siliconcloud-color.svg?raw';
import openrouterSvg from '@lobehub/icons-static-svg/icons/openrouter.svg?raw';

const props = withDefaults(defineProps<{
  providerId: string;
  providerName: string;
  iconColor?: string;
  size?: number;
}>(), {
  size: 36,
});

// Git 平台图标（内联 SVG）
const githubSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`;

const giteeSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.984 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0011.984 0zm4.22 5.77h3.1v1.47h-3.1V5.77zm-4.26 0h3.12v1.47H11.96V5.77zM7.7 5.77h3.1v1.47h-3.1V5.77zm4.26 3.16c2.45 0 4.43 1.74 4.43 3.89 0 2.15-1.98 3.9-4.43 3.9-2.44 0-4.42-1.75-4.42-3.9 0-2.15 1.98-3.89 4.42-3.89z"/></svg>`;

const ICON_MAP: Record<string, string> = {
  deepseek: deepseekSvg,
  openai: openaiSvg,
  zhipu: chatglmSvg,
  qwen: qwenSvg,
  moonshot: moonshotSvg,
  minimax: minimaxSvg,
  baichuan: baichuanSvg,
  stepfun: stepfunSvg,
  lingyi: zerooneSvg,
  siliconflow: siliconcloudSvg,
  openrouter: openrouterSvg,
  github: githubSvg,
  gitee: giteeSvg,
};

const svgContent = computed(() => ICON_MAP[props.providerId] ?? '');

const containerStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${Math.round(props.size * 0.25)}px`,
  background: props.iconColor ? `#${props.iconColor}20` : 'rgba(0,0,0,0.04)',
}));

const fallback = computed(() => {
  const letter = props.providerName.charAt(0).toUpperCase();
  const color = props.iconColor ?? '86868b';
  return `<span style="font-size:${Math.round(props.size * 0.45)}px;font-weight:700;color:#${color};line-height:1">${letter}</span>`;
});
</script>
