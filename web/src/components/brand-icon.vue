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
