<script setup lang="ts">
import { computed } from 'vue';
import { AddOutline, ChevronForwardOutline } from '@vicons/ionicons5';
import UiIcon from '../ui/UiIcon.vue';
import { useRouter } from 'vue-router';
import AgentStack from './agent-stack.vue';
import DistributionPicker from './distribution-picker.vue';
import type { AgentInfo, SkillInfo } from '../../api';

const props = defineProps<{ skill: SkillInfo; agents: AgentInfo[]; selected?: boolean; busy?: boolean }>();
const router = useRouter();
const emit = defineEmits<{
  select: [skill: SkillInfo];
  distribute: [skill: SkillInfo, input: { add: string[]; remove: string[]; mode: 'symlink' | 'copy' }];
}>();
const displayName = computed(() => props.skill.name.split('/').filter(Boolean).at(-1) ?? props.skill.name);
const namespace = computed(() => props.skill.name.includes('/') ? props.skill.name.slice(0, props.skill.name.lastIndexOf('/')) : 'Local workspace');
const initials = computed(() => displayName.value.split(/[-_\s]+/).map(part => part[0]).join('').slice(0, 2).toUpperCase());
function openDetails() { router.push({ name: 'skillDetail', params: { name: props.skill.name } }); }
</script>

<template>
  <article :class="['skill-card', selected && 'skill-card--selected']" tabindex="0" role="button" @click="emit('select', skill)" @keydown.enter="emit('select', skill)" @keydown.space.prevent="emit('select', skill)">
    <header>
      <span class="skill-glyph">{{ initials }}</span>
      <div class="skill-identity">
        <h2>{{ displayName }}</h2>
        <p>{{ namespace }}</p>
      </div>
      <span :class="['skill-state', skill.managed ? 'skill-state--ok' : 'skill-state--warning']">{{ skill.managed ? 'Managed' : 'Unlinked' }}</span>
    </header>
    <p class="skill-description">{{ skill.description || '暂无描述' }}</p>
    <footer>
      <div class="skill-meta">
        <span>v{{ skill.version }}</span>
        <i />
        <span>{{ skill.tags[0] || 'local' }}</span>
      </div>
      <div class="card-actions">
        <div class="distribution-summary">
          <AgentStack v-if="skill.agents.length" :agent-names="skill.agents" :agents="agents" />
          <small v-if="skill.agents.length">{{ skill.agents.length }}</small>
        </div>
        <button class="detail-action" type="button" :aria-label="`打开 ${skill.name} 详情`" @click.stop="openDetails"><UiIcon :component="ChevronForwardOutline" size="14" /></button>
        <DistributionPicker :skill="skill" :agents="agents" :busy="busy" @distribute="emit('distribute', skill, $event)">
          <button class="add-agent" type="button" :aria-label="`为 ${skill.name} 添加分发目标`" title="添加分发目标" @click.stop><UiIcon :component="AddOutline" size="14" /></button>
        </DistributionPicker>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.skill-card {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: .625rem;
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-lg);
  background: var(--color-paper);
  padding: 1rem;
  cursor: default;
  outline: none;
  box-shadow: var(--shadow-xs);
  transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.skill-card:hover {
  border-color: var(--color-rule-strong);
  box-shadow: var(--shadow-card);
}
.skill-card:focus-visible {
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}
.skill-card--selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent-soft);
}

.skill-card header {
  display: flex;
  align-items: center;
  gap: .625rem;
}
.skill-glyph {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: 700;
}
.skill-identity { min-width: 0; flex: 1; }
.skill-card h2 {
  overflow: hidden;
  margin: 0;
  color: var(--color-ink);
  font-size: var(--text-base);
  font-weight: 600;
  letter-spacing: -.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.skill-card header p {
  overflow: hidden;
  margin: .125rem 0 0;
  color: var(--color-faint);
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.skill-state {
  flex: none;
  border-radius: 999px;
  padding: .125rem .5rem;
  font-size: var(--text-xs);
  font-weight: 550;
}
.skill-state--ok {
  background: var(--color-success-soft);
  color: var(--color-success);
}
.skill-state--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.skill-description {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.skill-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
}
.skill-meta {
  display: flex;
  align-items: center;
  gap: .375rem;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
.skill-meta i {
  width: 2px;
  height: 2px;
  border-radius: 999px;
  background: var(--color-rule-strong);
}
.card-actions {
  display: flex;
  align-items: center;
  gap: .25rem;
}
.distribution-summary {
  display: flex;
  align-items: center;
}
.distribution-summary small {
  margin-left: .25rem;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
.detail-action, .add-agent {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--color-faint);
  transition: background var(--dur-fast), color var(--dur-fast);
}
.detail-action:hover, .add-agent:hover {
  background: var(--color-paper-2);
  color: var(--color-ink);
}
.add-agent:hover {
  color: var(--color-accent);
  background: var(--color-accent-soft);
}
</style>
