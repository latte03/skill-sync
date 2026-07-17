<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { CheckmarkOutline, LinkOutline } from '@vicons/ionicons5';
import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import type { AgentInfo, SkillInfo } from '../../api';
import AgentIcon from '../agent-icon.vue';

const props = defineProps<{ skill: SkillInfo; agents: AgentInfo[]; busy?: boolean }>();
const emit = defineEmits<{ preview: [input: { agents: string[]; mode: 'symlink' | 'copy' }]; distribute: [input: { agents: string[]; mode: 'symlink' | 'copy' }] }>();
const open = shallowRef(false);
const selected = shallowRef<string[]>([]);
const mode = shallowRef<'symlink' | 'copy'>('symlink');
const available = computed(() => props.agents.filter(agent => agent.installed && !props.skill.agents.includes(agent.name)));
watch(open, value => { if (value) { selected.value = []; mode.value = 'symlink'; } });
function confirm() { emit('distribute', { agents: selected.value, mode: mode.value }); open.value = false; }
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child><slot /></PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="distribution-popover" side="top" :side-offset="9" align="start" :collision-padding="12">
        <header><div><span>添加分发目标</span><h3>选择 Agent</h3><p>{{ skill.name }}</p></div><b>{{ selected.length }}</b></header>
        <div v-if="available.length" class="target-list">
          <label v-for="agent in available" :key="agent.name" class="target-option">
            <input v-model="selected" type="checkbox" :value="agent.name">
            <AgentIcon class="target-icon" :agent-id="agent.name" :agent-name="agent.displayName" :size="32" />
            <span class="target-copy"><b>{{ agent.displayName }}</b><small>{{ agent.skillsDir }}</small></span>
            <i class="target-check"><n-icon :component="CheckmarkOutline" size="12" /></i>
          </label>
        </div>
        <div v-else class="all-covered"><n-icon :component="CheckmarkOutline" size="17" /><b>已覆盖所有可用 Agent</b><span>无需添加新的分发目标。</span></div>
        <fieldset v-if="available.length"><legend>分发方式</legend><div><label><input v-model="mode" type="radio" value="symlink"><span><n-icon :component="LinkOutline" size="13" />符号链接</span></label><label><input v-model="mode" type="radio" value="copy"><span>复制副本</span></label></div></fieldset>
        <footer v-if="available.length"><button type="button" :disabled="!selected.length || busy" @click="emit('preview', { agents: selected, mode })">预览</button><button class="primary" type="button" :disabled="!selected.length || busy" @click="confirm">{{ busy ? '处理中…' : '添加分发' }}</button></footer>
        <PopoverArrow class="popover-arrow" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
.distribution-popover { z-index:85;display:grid;width:min(25rem,calc(100vw - 1.5rem));height:min(25rem,calc(100dvh - 1.5rem));max-height:var(--reka-popover-content-available-height);grid-template-rows:auto minmax(0,1fr) auto auto;overflow:hidden;border:1px solid var(--color-rule-strong);border-radius:.9rem;background:var(--color-paper);padding:.75rem;box-shadow:var(--shadow-lg);outline:none;transform-origin:var(--reka-popover-content-transform-origin);animation:popover-in var(--dur-base) var(--ease-out); }.distribution-popover header { display:flex;align-items:start;justify-content:space-between;gap:1rem;padding:.2rem .15rem .7rem; }.distribution-popover header span,.distribution-popover legend { color:var(--color-faint);font-family:var(--font-mono);font-size:.75rem;font-weight:650;letter-spacing:.1em;text-transform:uppercase; }.distribution-popover h3 { margin:.23rem 0 0;color:var(--color-ink);font-size:.82rem;letter-spacing:-.02em; }.distribution-popover header p { max-width:18rem;overflow:hidden;margin:.15rem 0 0;color:var(--color-muted);font-family:var(--font-mono);font-size:.75rem;text-overflow:ellipsis;white-space:nowrap; }.distribution-popover header > b { display:grid;width:1.6rem;height:1.6rem;place-items:center;border-radius:.48rem;background:var(--color-accent-soft);color:var(--color-accent);font-family:var(--font-mono);font-size:.75rem; }
.target-list { display:grid;min-height:0;align-content:start;gap:.28rem;overflow-x:hidden;overflow-y:auto;padding-right:.2rem; }.target-option { display:grid;min-height:3.4rem;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.7rem;border:1px solid transparent;border-radius:.68rem;padding:.5rem .6rem;cursor:pointer;transition:background var(--dur-fast),border-color var(--dur-fast),box-shadow var(--dur-fast); }.target-option:hover { border-color:color-mix(in srgb,var(--color-accent) 38%,var(--color-rule));background:color-mix(in srgb,var(--color-accent-soft) 68%,var(--color-paper));box-shadow:0 5px 16px color-mix(in srgb,var(--color-accent) 10%,transparent); }.target-option input { position:absolute;opacity:0;pointer-events:none; }.target-icon { background:var(--color-paper-3); }.target-copy { min-width:0; }.target-copy b,.target-copy small { display:block; }.target-copy b { color:var(--color-ink);font-size:.875rem;font-weight:620; }.target-copy small { overflow:hidden;margin-top:.08rem;color:var(--color-muted);font-family:var(--font-mono);font-size:.75rem;text-overflow:ellipsis;white-space:nowrap; }.target-check { display:grid;width:1.25rem;height:1.25rem;place-items:center;justify-self:end;border:1px solid var(--color-rule-strong);border-radius:.38rem;color:transparent; }.target-option:has(input:checked) { border-color:color-mix(in srgb,var(--color-accent) 45%,var(--color-rule));background:var(--color-accent-soft);box-shadow:inset 3px 0 0 var(--color-accent); }.target-option:has(input:checked) .target-icon { border-color:color-mix(in srgb,var(--color-accent) 45%,transparent);background:var(--color-paper); }.target-option:has(input:checked) .target-check { border-color:var(--color-accent);background:var(--color-accent);color:var(--color-accent-ink); }
.distribution-popover fieldset { margin:.7rem 0 0;padding:.7rem 0 0;border:0;border-top:1px solid var(--color-rule); }.distribution-popover legend { margin-bottom:.45rem; }.distribution-popover fieldset > div { display:grid;grid-template-columns:1fr 1fr;gap:.25rem;border-radius:.55rem;background:var(--color-paper-2);padding:.2rem; }.distribution-popover fieldset label input { position:absolute;opacity:0; }.distribution-popover fieldset label span { display:flex;min-height:2.25rem;align-items:center;justify-content:center;gap:.35rem;border-radius:.4rem;color:var(--color-muted);font-size:.75rem; }.distribution-popover fieldset input:checked + span { background:var(--color-paper);color:var(--color-ink);box-shadow:var(--shadow-xs); }.distribution-popover footer { display:flex;justify-content:flex-end;gap:.5rem;margin-top:.7rem;padding-top:.7rem;border-top:1px solid var(--color-rule); }.distribution-popover footer button { min-height:2.25rem;border:1px solid var(--color-rule);border-radius:.48rem;background:var(--color-paper);padding:0 .8rem;color:var(--color-ink-2);font-size:.75rem;font-weight:580; }.distribution-popover footer .primary { border-color:var(--color-accent);background:var(--color-accent);color:var(--color-accent-ink); }.distribution-popover footer button:disabled { opacity:.42; }.popover-arrow { fill:var(--color-paper-raised);stroke:var(--color-rule-strong); }.all-covered { display:grid;justify-items:center;padding:1.5rem .75rem;color:var(--color-success);text-align:center; }.all-covered b { margin-top:.5rem;color:var(--color-ink);font-size:.75rem; }.all-covered span { margin-top:.15rem;color:var(--color-muted);font-size:.75rem; }@keyframes popover-in { from { opacity:0;transform:scale(.97) translateY(.25rem); } }
</style>
