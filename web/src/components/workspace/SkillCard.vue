<script setup lang="ts">
import AgentStack from './AgentStack.vue';
import type { AgentInfo, SkillInfo } from '../../api';

defineProps<{ skill: SkillInfo; agents: AgentInfo[]; selected?: boolean }>();
const emit = defineEmits<{ select: [skill: SkillInfo]; distribute: [skill: SkillInfo]; agent: [agent: string] }>();
</script>

<template>
  <article :class="['skill-card', selected && 'skill-card--selected']" tabindex="0" role="button" @click="emit('select', skill)" @keydown.enter="emit('select', skill)">
    <header class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-3">
        <span class="skill-glyph">{{ skill.name.split('/').at(-1)?.slice(0, 2).toUpperCase() }}</span>
        <div class="min-w-0"><h2>{{ skill.name }}</h2><p class="skill-version">v{{ skill.version }}</p></div>
      </div>
      <span :class="['state-pill', skill.managed ? 'state-pill--ok' : 'state-pill--warning']"><i />{{ skill.managed ? '已纳管' : '待关联' }}</span>
    </header>
    <p class="skill-description">{{ skill.description || '尚未提供说明。' }}</p>
    <footer>
      <div class="flex min-w-0 flex-wrap gap-1.5"><span v-for="tag in skill.tags.slice(0, 2)" :key="tag" class="skill-tag">{{ tag }}</span><span v-if="skill.tags.length > 2" class="skill-tag">+{{ skill.tags.length - 2 }}</span><span v-if="!skill.tags.length" class="skill-source">本地 Skill</span></div>
      <div class="flex items-center gap-2"><AgentStack :agent-names="skill.agents" :agents="agents" @select="emit('agent', $event)" /><button class="add-agent" type="button" :aria-label="`为 ${skill.name} 添加分发目标`" title="添加分发目标" @click.stop="emit('distribute', skill)">+</button></div>
    </footer>
  </article>
</template>

<style scoped>
.skill-card { display: grid; min-height: 13.5rem; gap: 1.25rem; border: 1px solid var(--color-rule); border-radius: var(--radius-lg); background: color-mix(in oklch, var(--color-paper) 88%, transparent); padding: 1.25rem; box-shadow: var(--shadow-card); cursor: pointer; outline: none; transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }.skill-card:hover, .skill-card:focus-visible { border-color: var(--color-rule-strong); background: var(--color-paper); box-shadow: var(--shadow-md); transform: translateY(-3px); }.skill-card:focus-visible { box-shadow: 0 0 0 3px var(--color-focus-ring), var(--shadow-md); }.skill-card--selected { border-color: var(--color-accent); background: var(--color-paper); box-shadow: 0 0 0 1px var(--color-accent), var(--shadow-md); }.skill-glyph { display: grid; width: 2.5rem; height: 2.5rem; flex: none; place-items: center; border-radius: .78rem; background: var(--color-accent-soft); color: var(--color-accent); font-family: var(--font-mono); font-size: .7rem; font-weight: 700; }.skill-card h2 { margin: .1rem 0 0; overflow-wrap: anywhere; color: var(--color-ink); font-size: .875rem; font-weight: 650; letter-spacing: -.02em; }.skill-version,.skill-source { margin: .3rem 0 0; color: var(--color-muted); font-family: var(--font-mono); font-size: .64rem; }.state-pill { display: inline-flex; align-items: center; gap: .35rem; flex: none; border-radius: 999px; padding: .3rem .5rem; font-size: .68rem; font-weight: 600; white-space: nowrap; }.state-pill i { width: .4rem; height: .4rem; border-radius: 999px; }.state-pill--ok { background: var(--color-success-soft); color: var(--color-success); }.state-pill--ok i { background: var(--color-success); }.state-pill--warning { background: var(--color-warning-soft); color: var(--color-warning); }.state-pill--warning i { background: var(--color-warning); }.skill-description { margin: 0; color: var(--color-muted); font-size: .8125rem; line-height: 1.55; }.skill-card footer { display: flex; align-items: end; justify-content: space-between; gap: .75rem; margin-top: auto; }.skill-tag { border-radius: .4rem; background: var(--color-paper-3); padding: .25rem .4rem; color: var(--color-muted); font-family: var(--font-mono); font-size: .6rem; }.add-agent { display: grid; width: 2rem; height: 2rem; flex: none; place-items: center; border: 1px dashed var(--color-rule-strong); border-radius: 999px; background: transparent; color: var(--color-muted); font-size: 1.2rem; line-height: 1; transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out); }.add-agent:hover { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent); }
</style>
