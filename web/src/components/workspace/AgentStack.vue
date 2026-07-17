<script setup lang="ts">
import { computed } from 'vue';
import type { AgentInfo } from '../../api';

const props = withDefaults(defineProps<{ agentNames: string[]; agents: AgentInfo[]; max?: number }>(), { max: 3 });
const emit = defineEmits<{ select: [agent: string] }>();
const displayed = computed(() => props.agentNames.slice(0, props.max));
const overflow = computed(() => Math.max(0, props.agentNames.length - props.max));
const labelFor = (name: string) => props.agents.find(agent => agent.name === name)?.displayName ?? name;
const initials = (name: string) => labelFor(name).split(/[\s/-]+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
const tone = (name: string) => ['agent-blue', 'agent-violet', 'agent-mint', 'agent-amber'][name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4];
</script>

<template>
  <div class="flex items-center" aria-label="已分发 Agent">
    <button v-for="(name, index) in displayed" :key="name" :class="['agent-avatar', tone(name), index ? '-ml-2.5' : '']" type="button" :title="`${labelFor(name)}：已分发`" @click.stop="emit('select', name)">
      <span>{{ initials(name) }}</span><i aria-hidden="true" />
    </button>
    <span v-if="overflow" class="agent-avatar agent-more -ml-2.5" :title="`另有 ${overflow} 个已分发 Agent`">+{{ overflow }}</span>
  </div>
</template>

<style scoped>
.agent-avatar { position: relative; display: grid; width: 2rem; height: 2rem; place-items: center; border: 2px solid var(--color-paper); border-radius: 999px; color: var(--color-agent-ink); font-size: .625rem; font-weight: 700; letter-spacing: -.03em; box-shadow: 0 2px 5px color-mix(in oklch, var(--color-ink) 12%, transparent); transition: transform var(--dur-fast) var(--ease-out); }
button.agent-avatar:hover { transform: translateY(-2px); z-index: 2; }.agent-avatar i { position: absolute; right: -.05rem; bottom: -.05rem; width: .5rem; height: .5rem; border: 1.5px solid var(--color-paper); border-radius: 999px; background: var(--color-success); }.agent-blue { background: var(--color-agent-blue); }.agent-violet { background: var(--color-agent-violet); }.agent-mint { background: var(--color-agent-mint); }.agent-amber { background: var(--color-agent-amber); }.agent-more { background: var(--color-paper-3); color: var(--color-muted); font-size: .625rem; }
</style>
