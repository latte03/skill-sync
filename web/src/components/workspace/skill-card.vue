<script setup lang="ts">
import { computed } from 'vue';
import { AddOutline, ChevronForwardOutline } from '@vicons/ionicons5';
import { useRouter } from 'vue-router';
import AgentStack from './agent-stack.vue';
import DistributionPicker from './distribution-picker.vue';
import type { AgentInfo, SkillInfo } from '../../api';

const props = defineProps<{ skill: SkillInfo; agents: AgentInfo[]; selected?: boolean; busy?: boolean }>();
const router = useRouter();
const emit = defineEmits<{
  select: [skill: SkillInfo];
  preview: [skill: SkillInfo, input: { agents: string[]; mode: 'symlink' | 'copy' }];
  distribute: [skill: SkillInfo, input: { agents: string[]; mode: 'symlink' | 'copy' }];
}>();
const displayName = computed(() => props.skill.name.split('/').filter(Boolean).at(-1) ?? props.skill.name);
const namespace = computed(() => props.skill.name.includes('/') ? props.skill.name.slice(0, props.skill.name.lastIndexOf('/')) : 'Local workspace');
const initials = computed(() => displayName.value.split(/[-_\s]+/).map(part => part[0]).join('').slice(0, 2).toUpperCase());
function openDetails() { router.push({ name: 'skillDetail', params: { name: props.skill.name } }); }
</script>

<template>
  <article :class="['skill-card', selected && 'skill-card--selected']" tabindex="0" role="button" @click="emit('select', skill)" @keydown.enter="emit('select', skill)" @keydown.space.prevent="emit('select', skill)">
    <header><span class="skill-glyph">{{ initials }}</span><div><h2>{{ displayName }}</h2><p>{{ namespace }}</p></div><span :class="['skill-state', skill.managed ? 'skill-state--ok' : 'skill-state--warning']"><i />{{ skill.managed ? 'Managed' : 'Unlinked' }}</span></header>
    <p class="skill-description">{{ skill.description || '这个 Skill 暂时没有提供描述。' }}</p>
    <div class="skill-meta"><span>v{{ skill.version }}</span><i /> <span>{{ skill.tags[0] || 'local' }}</span></div>
    <footer><div class="distribution-summary"><AgentStack v-if="skill.agents.length" :agent-names="skill.agents" :agents="agents" /><span v-else>尚未分发</span><small v-if="skill.agents.length">{{ skill.agents.length }} targets</small></div><div class="card-actions"><button class="detail-action" type="button" :aria-label="`打开 ${skill.name} 完整详情`" @click.stop="openDetails">详情<n-icon :component="ChevronForwardOutline" size="13" /></button><DistributionPicker :skill="skill" :agents="agents" :busy="busy" @preview="emit('preview', skill, $event)" @distribute="emit('distribute', skill, $event)"><button class="add-agent" type="button" :aria-label="`为 ${skill.name} 添加分发目标`" title="添加分发目标" @click.stop><n-icon :component="AddOutline" size="15" /></button></DistributionPicker></div></footer>
  </article>
</template>

<style scoped>
.skill-card { position: relative; display: grid; min-height: 10.25rem; grid-template-rows: auto minmax(2.6rem,auto) auto auto; gap: .72rem; overflow: visible; border: 1px solid var(--color-rule); border-radius: var(--radius-lg); background: var(--color-paper); padding: .85rem; box-shadow: var(--shadow-xs); cursor: default; outline: none; transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }.skill-card:hover { border-color: var(--color-rule-strong); box-shadow: var(--shadow-card); transform: translateY(-1px); }.skill-card:focus-visible { box-shadow: 0 0 0 3px var(--color-focus-ring), var(--shadow-card); }.skill-card--selected { border-color: color-mix(in srgb, var(--color-accent) 58%, var(--color-rule)); box-shadow: 0 0 0 1px var(--color-accent-soft), var(--shadow-card); }
.skill-card header { display: grid; min-width: 0; grid-template-columns: auto minmax(0,1fr) auto; align-items: start; gap: .65rem; }.skill-glyph { display: grid; width: 2rem; height: 2rem; place-items: center; border: 1px solid var(--color-rule); border-radius: .62rem; background: linear-gradient(150deg, var(--color-paper), var(--color-paper-3)); color: var(--color-accent); font-family: var(--font-mono); font-size: .75rem; font-weight: 750; box-shadow: var(--shadow-xs); }.skill-card h2 { overflow: hidden; margin: .06rem 0 0; color: var(--color-ink); font-size: .76rem; font-weight: 650; letter-spacing: -.02em; text-overflow: ellipsis; white-space: nowrap; }.skill-card header p { overflow: hidden; margin: .08rem 0 0; color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; }.skill-state { display: flex; align-items: center; gap: .27rem; margin-top: .08rem; color: var(--color-muted); font-family: var(--font-mono); font-size: .75rem; }.skill-state i { width: .34rem; height: .34rem; border-radius: 999px; }.skill-state--ok i { background: var(--color-success); box-shadow: 0 0 0 3px var(--color-success-soft); }.skill-state--warning { color: var(--color-warning); }.skill-state--warning i { background: var(--color-warning); box-shadow: 0 0 0 3px var(--color-warning-soft); }
.skill-description { display: -webkit-box; overflow: hidden; max-height: 2.05rem; margin: 0; color: var(--color-muted); font-size: .75rem; line-height: 1.48; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.skill-meta { display: flex; align-items: center; gap: .38rem; color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; }.skill-meta i { width: .18rem; height: .18rem; border-radius: 999px; background: var(--color-rule-strong); }.skill-card footer { display: flex; min-width: 0; align-items: end; justify-content: space-between; gap: .65rem; padding-top: .68rem; border-top: 1px solid var(--color-rule); }.distribution-summary { display: flex; min-width: 0; align-items: center; }.distribution-summary > span { color: var(--color-faint); font-size: .75rem; }.distribution-summary small { margin-left: .45rem; color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; }.card-actions { display:flex;min-width:0;align-items:center;justify-content:flex-end;gap:.35rem;margin-left:auto; }.add-agent { display:grid;width:1.65rem;height:1.65rem;flex:none;place-items:center;border:1px dashed var(--color-rule);border-radius:.48rem;background:var(--color-paper);color:var(--color-muted); }.add-agent:hover { border-style:solid;border-color:var(--color-accent);background:var(--color-accent-soft);color:var(--color-accent); }.detail-action { display:flex;height:1.65rem;align-items:center;gap:.15rem;border:1px solid transparent;border-radius:.48rem;background:transparent;padding:0 .3rem 0 .5rem;color:var(--color-muted);font-size:.75rem;font-weight:590;opacity:0;pointer-events:none;transform:translateX(.3rem);transition:opacity var(--dur-fast),transform var(--dur-fast) var(--ease-out),border-color var(--dur-fast),background var(--dur-fast),color var(--dur-fast); }.skill-card:hover .detail-action,.skill-card:focus-within .detail-action,.skill-card--selected .detail-action,.detail-action:focus-visible { opacity:1;pointer-events:auto;transform:none; }.detail-action:hover { border-color:var(--color-rule-strong);background:var(--color-paper-3);color:var(--color-ink); }
.skill-card { min-height: 12rem; grid-template-rows: auto minmax(3.1rem,auto) auto auto; gap: .95rem; padding: 1.05rem; }
.skill-card header { gap: .8rem; }.skill-glyph { width: 2.35rem; height: 2.35rem; font-size: .75rem; }
.skill-description { max-height: 2.55rem; font-size: .76rem; line-height: 1.58; }
.skill-meta { gap: .5rem; }.skill-card footer { gap: .8rem; padding-top: .9rem; }
.distribution-summary>span { font-size: .75rem; }.distribution-summary small { font-size: .75rem; }
.add-agent { width:1.95rem;height:1.95rem; }.detail-action { height:1.95rem;padding-inline:.6rem .35rem; }
</style>
