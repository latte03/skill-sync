<script setup lang="ts">
  import { computed } from 'vue'
  import { CheckmarkCircleOutline } from '@vicons/ionicons5'
  import UiIcon from '../ui/UiIcon.vue'
  import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
  import type { AgentInfo } from '../../api'
  import AgentIcon from '../agent-icon.vue'

  const props = withDefaults(
    defineProps<{ agentNames: string[]; agents: AgentInfo[]; max?: number }>(),
    { max: 3 }
  )
  const displayed = computed(() => props.agentNames.slice(0, props.max))
  const overflow = computed(() => Math.max(0, props.agentNames.length - props.max))
  const details = (name: string) => props.agents.find((agent) => agent.name === name)
  const labelFor = (name: string) => details(name)?.displayName ?? name
  const tone = (name: string) =>
    ['agent-blue', 'agent-violet', 'agent-mint', 'agent-amber'][
      name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4
    ]
</script>

<template>
  <div class="agent-stack" :aria-label="`已分发到 ${agentNames.length} 个 Agent`">
    <PopoverRoot v-for="(name, index) in displayed" :key="name">
      <PopoverTrigger as-child
        ><button
          :class="['agent-avatar', tone(name), index && 'agent-avatar--overlap']"
          type="button"
          :aria-label="`查看 ${labelFor(name)} 分发状态`"
          @click.stop
        >
          <AgentIcon :agent-id="name" :agent-name="labelFor(name)" :size="22" /><i /></button
      ></PopoverTrigger>
      <PopoverPortal
        ><PopoverContent class="agent-popover" side="top" :side-offset="7" align="center"
          ><AgentIcon :agent-id="name" :agent-name="labelFor(name)" :size="32" />
          <div>
            <b>{{ labelFor(name) }}</b
            ><span><UiIcon :component="CheckmarkCircleOutline" size="12" />已分发并登记</span
            ><code>{{ details(name)?.skillsDir }}</code>
          </div>
          <PopoverArrow class="agent-arrow" /></PopoverContent
      ></PopoverPortal>
    </PopoverRoot>
    <span
      v-if="overflow"
      class="agent-avatar agent-more agent-avatar--overlap"
      :title="`另有 ${overflow} 个 Agent`"
      >+{{ overflow }}</span
    >
  </div>
</template>

<style scoped>
  .agent-stack {
    display: flex;
    align-items: center;
  }
  .agent-avatar {
    position: relative;
    z-index: 1;
    display: grid;
    width: 1.65rem;
    height: 1.65rem;
    flex: none;
    place-items: center;
    overflow: visible;
    border: 2px solid var(--color-paper);
    border-radius: var(--radius-sm);
    background: transparent;
    padding: 0;
    color: var(--color-agent-ink);
    font-size: 0.75rem;
    font-weight: 750;
    line-height: 1;
    letter-spacing: -0.03em;
    box-shadow: 0 2px 6px rgba(20, 20, 25, 0.1);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .agent-avatar--overlap {
    margin-left: -0.45rem;
  }
  .agent-avatar:hover {
    z-index: 3;
    transform: translateY(-2px);
  }
  .agent-avatar i {
    position: absolute;
    right: -0.1rem;
    bottom: -0.1rem;
    width: 0.6rem;
    height: 0.6rem;
    border: 1.5px solid var(--color-paper);
    border-radius: 999px;
    background: var(--color-success);
  }
  .agent-blue {
    background: var(--color-agent-blue);
  }
  .agent-violet {
    background: var(--color-agent-violet);
  }
  .agent-mint {
    background: var(--color-agent-mint);
  }
  .agent-amber {
    background: var(--color-agent-amber);
  }
  .agent-more {
    background: var(--color-paper-3);
    color: var(--color-muted);
  }
  .agent-popover {
    z-index: 86;
    display: grid;
    width: 15rem;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.65rem;
    border: 1px solid var(--color-rule-strong);
    border-radius: var(--radius-lg);
    background: var(--color-paper-raised);
    padding: 0.7rem;
    box-shadow: var(--shadow-md);
    outline: none;
    backdrop-filter: blur(24px);
    animation: agent-in var(--dur-fast) var(--ease-out);
  }
  .agent-popover-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: var(--radius-sm);
    color: var(--color-agent-ink);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 750;
  }
  .agent-popover b,
  .agent-popover span,
  .agent-popover code {
    display: block;
  }
  .agent-popover b {
    color: var(--color-ink);
    font-size: 0.75rem;
  }
  .agent-popover span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.12rem;
    color: var(--color-success);
    font-size: 0.75rem;
  }
  .agent-popover code {
    overflow: hidden;
    margin-top: 0.3rem;
    color: var(--color-faint);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .agent-arrow {
    fill: var(--color-paper-raised);
    stroke: var(--color-rule-strong);
  }
  @keyframes agent-in {
    from {
      opacity: 0;
      transform: translateY(0.2rem) scale(0.98);
    }
  }
</style>
