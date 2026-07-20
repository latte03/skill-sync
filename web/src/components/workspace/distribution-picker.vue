<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { AddOutline, CheckmarkOutline, LinkOutline, RemoveOutline } from '@vicons/ionicons5';
import UiIcon from '../ui/UiIcon.vue';
import UiSegmented from '../ui/UiSegmented.vue';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import type { AgentInfo, SkillInfo } from '../../api';
import AgentIcon from '../agent-icon.vue';

export interface DistributionInput {
  add: string[];
  remove: string[];
  mode: 'symlink' | 'copy';
}

const props = defineProps<{ skill: SkillInfo; agents: AgentInfo[]; busy?: boolean }>();
const emit = defineEmits<{ distribute: [input: DistributionInput] }>();

const open = shallowRef(false);
const confirming = shallowRef(false);
const selected = shallowRef<string[]>([]);
const mode = shallowRef<'symlink' | 'copy'>('symlink');
const modeOptions = [
  { value: 'symlink', label: '符号链接', icon: LinkOutline },
  { value: 'copy', label: '复制副本' },
];

const installedAgents = computed(() => props.agents.filter(agent => agent.installed));
const original = computed(() => props.skill.agents);
const added = computed(() => selected.value.filter(name => !original.value.includes(name)));
const removed = computed(() => original.value.filter(name => !selected.value.includes(name)));
const hasChanges = computed(() => added.value.length > 0 || removed.value.length > 0);
const hasRemoval = computed(() => removed.value.length > 0);

watch(open, value => {
  if (value) {
    selected.value = [...original.value];
    mode.value = 'symlink';
    confirming.value = false;
  }
});

function submit() {
  if (!hasChanges.value) return;
  if (hasRemoval.value) { confirming.value = true; return; }
  doEmit();
}

function doEmit() {
  emit('distribute', { add: added.value, remove: removed.value, mode: mode.value });
  open.value = false;
  confirming.value = false;
}

function agentName(name: string) {
  return props.agents.find(agent => agent.name === name)?.displayName ?? name;
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child><slot /></PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="distribution-popover" side="top" :side-offset="9" align="start" :collision-padding="12">
        <template v-if="!confirming">
          <header>
            <div><span>分发目标</span><h3>选择 Agent</h3><p>{{ skill.name }}</p></div>
            <b>{{ selected.length }}</b>
          </header>
          <div v-if="installedAgents.length" class="target-list">
            <label v-for="agent in installedAgents" :key="agent.name" class="target-option">
              <input v-model="selected" type="checkbox" :value="agent.name">
              <AgentIcon class="target-icon" :agent-id="agent.name" :agent-name="agent.displayName" :size="32" />
              <span class="target-copy"><b>{{ agent.displayName }}</b><small>{{ agent.skillsDir }}</small></span>
              <i class="target-check"><UiIcon :component="CheckmarkOutline" size="12" /></i>
            </label>
          </div>
          <div v-else class="all-covered"><UiIcon :component="CheckmarkOutline" size="17" /><b>没有已安装的 Agent</b><span>请先安装至少一个 Agent。</span></div>
          <div v-if="installedAgents.length" class="mode-section">
            <UiSegmented v-model="mode" :options="modeOptions" size="sm" block />
          </div>
          <footer v-if="installedAgents.length">
            <button class="primary" type="button" :disabled="!hasChanges || busy" @click="submit">{{ busy ? '处理中…' : hasRemoval ? '重新分发' : '添加分发' }}</button>
          </footer>
        </template>
        <template v-else>
          <header><div><span>确认变更</span><h3>分发调整预览</h3><p>{{ skill.name }}</p></div></header>
          <div class="confirm-diff">
            <div v-if="added.length" class="diff-group">
              <span class="diff-label add"><UiIcon :component="AddOutline" size="12" />新增</span>
              <div v-for="name in added" :key="name" class="diff-item add"><AgentIcon :agent-id="name" :agent-name="agentName(name)" :size="22" /><b>{{ agentName(name) }}</b></div>
            </div>
            <div v-if="removed.length" class="diff-group">
              <span class="diff-label remove"><UiIcon :component="RemoveOutline" size="12" />移除</span>
              <div v-for="name in removed" :key="name" class="diff-item remove"><AgentIcon :agent-id="name" :agent-name="agentName(name)" :size="22" /><b>{{ agentName(name) }}</b></div>
            </div>
          </div>
          <footer>
            <button type="button" @click="confirming = false">返回</button>
            <button class="primary" type="button" :disabled="busy" @click="doEmit">{{ busy ? '处理中…' : '确认分发' }}</button>
          </footer>
        </template>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
.distribution-popover { z-index:85;display:grid;width:min(25rem,calc(100vw - 1.5rem));grid-template-rows:auto minmax(0,1fr) auto auto;border:1px solid var(--color-rule-strong);border-radius:var(--radius-xl);background:var(--color-paper);padding:.75rem;box-shadow:var(--shadow-lg);outline:none;transform-origin:var(--reka-popover-content-transform-origin);animation:popover-in var(--dur-base) var(--ease-out); }
.distribution-popover header { display:flex;align-items:start;justify-content:space-between;gap:1rem;padding:.2rem .15rem .7rem; }
.distribution-popover header span { color:var(--color-faint);font-family:var(--font-mono);font-size:.75rem;font-weight:650;letter-spacing:.1em;text-transform:uppercase; }
.distribution-popover h3 { margin:.23rem 0 0;color:var(--color-ink);font-size:.82rem;letter-spacing:-.02em; }
.distribution-popover header p { max-width:18rem;overflow:hidden;margin:.15rem 0 0;color:var(--color-muted);font-family:var(--font-mono);font-size:.75rem;text-overflow:ellipsis;white-space:nowrap; }
.distribution-popover header > b { display:grid;width:1.6rem;height:1.6rem;place-items:center;border-radius:var(--radius-sm);background:var(--color-accent-soft);color:var(--color-accent);font-family:var(--font-mono);font-size:.75rem; }
.target-list { display:grid;min-height:0;max-height:16rem;align-content:start;gap:.28rem;overflow-x:hidden;overflow-y:auto;padding-right:.2rem; }
.target-option { display:grid;min-height:3.4rem;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.7rem;border:1px solid transparent;border-radius:var(--radius-md);padding:.5rem .6rem;cursor:pointer;transition:background var(--dur-fast),border-color var(--dur-fast),box-shadow var(--dur-fast); }
.target-option:hover { border-color:color-mix(in srgb,var(--color-accent) 38%,var(--color-rule));background:color-mix(in srgb,var(--color-accent-soft) 68%,var(--color-paper));box-shadow:0 5px 16px color-mix(in srgb,var(--color-accent) 10%,transparent); }
.target-option input { position:absolute;opacity:0;pointer-events:none; }
.target-icon { background:var(--color-paper-3); }
.target-copy { min-width:0; }
.target-copy b,.target-copy small { display:block; }
.target-copy b { color:var(--color-ink);font-size:.875rem;font-weight:620; }
.target-copy small { overflow:hidden;margin-top:.08rem;color:var(--color-muted);font-family:var(--font-mono);font-size:.75rem;text-overflow:ellipsis;white-space:nowrap; }
.target-check { display:grid;width:1.25rem;height:1.25rem;place-items:center;justify-self:end;border:1px solid var(--color-rule-strong);border-radius:var(--radius-xs);color:transparent; }
.target-option:has(input:checked) { border-color:color-mix(in srgb,var(--color-accent) 45%,var(--color-rule));background:var(--color-accent-soft);box-shadow:inset 3px 0 0 var(--color-accent); }
.target-option:has(input:checked) .target-icon { border-color:color-mix(in srgb,var(--color-accent) 45%,transparent);background:var(--color-paper); }
.target-option:has(input:checked) .target-check { border-color:var(--color-accent);background:var(--color-accent);color:var(--color-accent-ink); }
.mode-section { padding:.7rem 0 0;margin-top:.7rem; }
.distribution-popover footer { display:flex;justify-content:flex-end;gap:.5rem;margin-top:.7rem;padding-top:.7rem; }
.distribution-popover footer button { min-height:2.25rem;border:1px solid var(--color-rule);border-radius:var(--radius-sm);background:var(--color-paper);padding:0 .8rem;color:var(--color-ink-2);font-size:.75rem;font-weight:580;cursor:pointer; }
.distribution-popover footer .primary { border-color:var(--color-accent);background:var(--color-accent);color:var(--color-accent-ink); }
.distribution-popover footer button:disabled { opacity:.42;cursor:default; }
.all-covered { display:grid;justify-items:center;padding:1.5rem .75rem;color:var(--color-success);text-align:center; }
.all-covered b { margin-top:.5rem;color:var(--color-ink);font-size:.75rem; }
.all-covered span { margin-top:.15rem;color:var(--color-muted);font-size:.75rem; }
.confirm-diff { display:grid;gap:.75rem;min-height:0;overflow-y:auto;padding:.2rem .15rem; }
.diff-group { display:grid;gap:.3rem; }
.diff-label { display:inline-flex;align-items:center;gap:.3rem;font-size:.7rem;font-weight:650;letter-spacing:.04em;text-transform:uppercase; }
.diff-label.add { color:var(--color-success); }
.diff-label.remove { color:var(--color-danger); }
.diff-item { display:flex;align-items:center;gap:.5rem;border-radius:var(--radius-sm);padding:.4rem .55rem;font-size:.8rem; }
.diff-item.add { background:color-mix(in srgb,var(--color-success) 8%,var(--color-paper)); }
.diff-item.remove { background:color-mix(in srgb,var(--color-danger) 8%,var(--color-paper)); }
.diff-item b { color:var(--color-ink);font-weight:600; }
@keyframes popover-in { from { opacity:0;transform:scale(.96) translateY(.3rem); } }
</style>
