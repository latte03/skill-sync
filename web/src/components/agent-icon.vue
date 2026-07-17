<script setup lang="ts">
import { computed } from 'vue';
import claudeCodeSvg from '@lobehub/icons-static-svg/icons/claudecode-color.svg?raw';
import cursorSvg from '@lobehub/icons-static-svg/icons/cursor.svg?raw';
import openCodeSvg from '@lobehub/icons-static-svg/icons/opencode.svg?raw';
import codexSvg from '@lobehub/icons-static-svg/icons/codex-color.svg?raw';
import codeBuddySvg from '@lobehub/icons-static-svg/icons/codebuddy-color.svg?raw';
import hermesSvg from '@lobehub/icons-static-svg/icons/hermesagent.svg?raw';
import qoderSvg from '@lobehub/icons-static-svg/icons/qoder-color.svg?raw';
import traeSvg from '@lobehub/icons-static-svg/icons/trae-color.svg?raw';
import windsurfSvg from '@lobehub/icons-static-svg/icons/windsurf.svg?raw';
import geminiCliSvg from '@lobehub/icons-static-svg/icons/geminicli-color.svg?raw';
import openClawSvg from '@lobehub/icons-static-svg/icons/openclaw-color.svg?raw';

const props = withDefaults(defineProps<{
  agentId: string;
  agentName?: string;
  size?: number;
}>(), { agentName: '', size: 32 });

const iconMap: Record<string, string> = {
  'claude-code': claudeCodeSvg,
  claude: claudeCodeSvg,
  cursor: cursorSvg,
  opencode: openCodeSvg,
  codex: codexSvg,
  codebuddy: codeBuddySvg,
  'hermes-agent': hermesSvg,
  hermes: hermesSvg,
  qoder: qoderSvg,
  'qoder-cn': qoderSvg,
  trae: traeSvg,
  'trae-cn': traeSvg,
  windsurf: windsurfSvg,
  'gemini-cli': geminiCliSvg,
  openclaw: openClawSvg,
};
const normalizedId = computed(() => props.agentId.toLowerCase());
const svg = computed(() => iconMap[normalizedId.value] ?? '');
const initials = computed(() => (props.agentName || props.agentId)
  .split(/[\s/_-]+/)
  .map(part => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase());
</script>

<template>
  <span class="agent-brand-icon" :style="{ width: `${size}px`, height: `${size}px` }">
    <span v-if="svg" class="agent-brand-icon__svg" v-html="svg" />
    <b v-else>{{ initials }}</b>
  </span>
</template>

<style scoped>
.agent-brand-icon { display:grid;flex:none;place-items:center;border:1px solid var(--color-rule-strong);border-radius:28%;background:color-mix(in srgb,var(--color-paper) 84%,transparent);color:var(--color-ink-2);box-shadow:inset 0 1px 0 rgba(255,255,255,.12);overflow:hidden; }
.agent-brand-icon__svg { display:grid;width:64%;height:64%;place-items:center; }
.agent-brand-icon__svg :deep(svg) { display:block;width:100%;height:100%; }
.agent-brand-icon b { font-family:var(--font-mono);font-size:.75rem;font-weight:720;letter-spacing:-.03em; }
</style>
