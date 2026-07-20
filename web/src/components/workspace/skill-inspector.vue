<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { CloseOutline, OpenOutline } from '@vicons/ionicons5';
import UiIcon from '../ui/UiIcon.vue';
import { AnimatePresence, motion } from 'motion-v';
import type { AgentInfo, SkillDetail, SkillInfo } from '../../api';
import AgentStack from './agent-stack.vue';
import DistributionPicker from './distribution-picker.vue';

const props = defineProps<{ skill: SkillInfo | null; detail: SkillDetail | null; agents: AgentInfo[]; loading?: boolean; busy?: boolean }>();
const emit = defineEmits<{
  close: [];
  distribute: [skill: SkillInfo, input: { add: string[]; remove: string[]; mode: 'symlink' | 'copy' }];
}>();
const router = useRouter();
const coreDetail = computed(() => props.detail?.skill ?? null);
const source = computed(() => {
  const item = coreDetail.value?.source;
  if (!item) return props.loading ? '读取来源信息…' : '本地工作区';
  return item.type === 'github' ? [item.owner, item.repo, item.skillPath ?? item.path].filter(Boolean).join('/') : '本地来源';
});
const installedAgents = computed(() => props.agents.filter(agent => agent.installed));
function openDetails() { if (props.skill) router.push({ name: 'skillDetail', params: { name: props.skill.name } }); }
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.skill)
    emit('close');
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div v-if="skill" :key="skill.name" class="inspector-layer" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }" :transition="{ duration: .14 }">
        <button class="inspector-scrim" type="button" aria-label="关闭 Inspector" @click="emit('close')" />
        <motion.aside class="skill-inspector" aria-label="Skill Inspector" :initial="{ x: 24, opacity: 0 }" :animate="{ x: 0, opacity: 1 }" :exit="{ x: 16, opacity: 0 }" :transition="{ type: 'spring', stiffness: 500, damping: 40 }">
          <header>
            <div class="inspector-identity">
              <span class="inspector-glyph">{{ skill.name.split('/').at(-1)?.slice(0, 2).toUpperCase() }}</span>
              <div>
                <h2>{{ skill.name.split('/').at(-1) }}</h2>
                <small>{{ skill.name }}</small>
              </div>
            </div>
            <button type="button" aria-label="关闭" @click="emit('close')"><UiIcon :component="CloseOutline" size="15" /></button>
          </header>
          <div class="inspector-scroll">
            <section class="health-card">
              <i :class="skill.managed ? 'ok' : 'warning'" />
              <div><b>{{ skill.managed ? '状态正常' : '需要关联来源' }}</b><span>{{ skill.agents.length ? `已分发至 ${skill.agents.length} 个 Agent` : '尚未配置分发目标' }}</span></div>
              <em>{{ skill.managed ? '已纳管' : '待检查' }}</em>
            </section>
            <section class="info-section"><div class="section-heading"><p>来源</p><span>{{ coreDetail?.source?.type === 'github' ? '远程' : '本地' }}</span></div><code>{{ source }}</code><small v-if="coreDetail?.source?.commit">commit {{ coreDetail.source.commit.slice(0, 10) }}</small></section>
            <section class="info-section"><div class="section-heading"><p>版本</p></div><div class="version-row"><b>v{{ skill.version }}</b><small>{{ coreDetail?.updatedAt ? new Date(coreDetail.updatedAt).toLocaleString() : loading ? '读取中…' : '暂无' }}</small></div></section>
            <section class="info-section"><div class="section-heading"><p>分发</p><span>{{ skill.agents.length }} / {{ installedAgents.length }}</span></div><div v-if="skill.agents.length" class="distribution-list"><div v-for="agentName in skill.agents" :key="agentName"><span><i />{{ agents.find(agent => agent.name === agentName)?.displayName ?? agentName }}</span><small>{{ coreDetail?.distribution?.find(item => item.agent === agentName)?.mode ?? 'symlink' }}</small></div></div><div v-else class="empty-distribution"><span>尚未分发</span><small>使用下方按钮添加目标</small></div><AgentStack v-if="skill.agents.length" :agent-names="skill.agents" :agents="agents" /></section>
            <section v-if="skill.tags.length" class="info-section"><div class="section-heading"><p>标签</p><span>{{ skill.tags.length }}</span></div><div class="tag-list"><span v-for="tag in skill.tags" :key="tag">{{ tag }}</span></div></section>
            <section v-if="coreDetail?.dependencies?.length" class="info-section"><div class="section-heading"><p>依赖</p><span>{{ coreDetail.dependencies.length }}</span></div><small>更新前可在完整详情中审查。</small></section>
          </div>
          <footer>
            <button class="secondary" type="button" @click="openDetails"><UiIcon :component="OpenOutline" size="13" />详情</button>
            <DistributionPicker :skill="skill" :agents="agents" :busy="busy" @distribute="emit('distribute', skill, $event)">
              <button class="primary" type="button">{{ skill.agents.length ? '添加目标' : '开始分发' }}</button>
            </DistributionPicker>
          </footer>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<style scoped>
.inspector-layer { position:fixed;inset:0;z-index:70;pointer-events:none; }
.inspector-scrim { position:absolute;inset:0;border:0;background:var(--color-inspector-scrim);pointer-events:auto; }

.skill-inspector {
  position:absolute;top:calc(var(--toolbar-height) + .5rem);right:.5rem;bottom:.5rem;
  display:grid;width:min(22rem,calc(100vw - 1rem));grid-template-rows:auto minmax(0,1fr) auto;
  overflow:hidden;border:1px solid var(--color-rule-strong);border-radius:var(--radius-xl);
  background:var(--color-glass-strong);backdrop-filter:saturate(165%) blur(34px);
  box-shadow:var(--shadow-lg);pointer-events:auto;
}

.skill-inspector > header { display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--color-rule);padding:1rem; }
.inspector-identity { display:flex;min-width:0;gap:.625rem; }
.inspector-glyph { display:grid;width:2rem;height:2rem;flex:none;place-items:center;border-radius:var(--radius-sm);background:var(--color-accent-soft);color:var(--color-accent);font-family:var(--font-mono);font-size:var(--text-xs);font-weight:700; }
.inspector-identity h2 { margin:0;color:var(--color-ink);font-size:var(--text-base);font-weight:650;letter-spacing:-.01em; }
.inspector-identity small { display:block;overflow:hidden;max-width:13rem;margin-top:.125rem;color:var(--color-faint);font-family:var(--font-mono);font-size:var(--text-xs);text-overflow:ellipsis;white-space:nowrap; }
.skill-inspector > header > button { display:grid;width:1.625rem;height:1.625rem;place-items:center;border:0;border-radius:var(--radius-xs);background:transparent;color:var(--color-faint);transition:background var(--dur-fast),color var(--dur-fast); }
.skill-inspector > header > button:hover { background:var(--color-paper-2);color:var(--color-ink); }

.inspector-scroll { display:grid;align-content:start;gap:1rem;overflow:auto;padding:1rem; }

.health-card { display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.625rem;border:1px solid var(--color-rule);border-radius:var(--radius-md);background:var(--color-paper-2);padding:.75rem; }
.health-card > i { width:.5rem;height:.5rem;border-radius:999px; }
.health-card > i.ok { background:var(--color-success); }
.health-card > i.warning { background:var(--color-warning); }
.health-card b { display:block;color:var(--color-ink);font-size:var(--text-sm);font-weight:600; }
.health-card span { display:block;margin-top:.125rem;color:var(--color-muted);font-size:var(--text-xs); }
.health-card em { border-radius:999px;background:var(--color-paper);padding:.125rem .5rem;color:var(--color-faint);font-size:var(--text-xs);font-style:normal; }

.info-section { display:grid;gap:.5rem; }
.section-heading { display:flex;align-items:center;justify-content:space-between; }
.section-heading p { margin:0;color:var(--color-faint);font-size:var(--text-xs);font-weight:600;letter-spacing:.04em;text-transform:uppercase; }
.section-heading span { color:var(--color-faint);font-family:var(--font-mono);font-size:var(--text-xs); }
.info-section code { overflow-wrap:anywhere;color:var(--color-ink-2);font-family:var(--font-mono);font-size:var(--text-xs);line-height:1.5; }
.info-section > small, .version-row small { color:var(--color-muted);font-size:var(--text-xs); }
.version-row { display:flex;align-items:baseline;justify-content:space-between;gap:.5rem; }
.version-row b { color:var(--color-ink);font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600; }

.distribution-list { display:grid;gap:2px; }
.distribution-list > div { display:flex;align-items:center;justify-content:space-between;gap:.5rem;border-radius:var(--radius-xs);padding:.375rem .375rem; }
.distribution-list > div:hover { background:var(--color-paper-2); }
.distribution-list span { display:flex;align-items:center;gap:.375rem;color:var(--color-ink-2);font-size:var(--text-sm); }
.distribution-list span i { width:.375rem;height:.375rem;border-radius:999px;background:var(--color-success); }
.distribution-list small { color:var(--color-faint);font-family:var(--font-mono);font-size:var(--text-xs); }
.empty-distribution { display:grid;gap:.125rem;border:1px solid var(--color-rule);border-radius:var(--radius-sm);padding:.625rem; }
.empty-distribution span { color:var(--color-ink-2);font-size:var(--text-sm); }
.empty-distribution small { color:var(--color-faint);font-size:var(--text-xs); }

.tag-list { display:flex;flex-wrap:wrap;gap:.25rem; }
.tag-list span { border-radius:var(--radius-xs);background:var(--color-paper-2);padding:.2rem .5rem;color:var(--color-muted);font-family:var(--font-mono);font-size:var(--text-xs); }

.skill-inspector > footer { display:flex;gap:.5rem;border-top:1px solid var(--color-rule);padding:.875rem 1rem; }
.skill-inspector > footer button { display:flex;height:2.125rem;align-items:center;justify-content:center;gap:.375rem;border-radius:var(--radius-sm);padding:0 .75rem;font-size:var(--text-sm);font-weight:550;transition:background var(--dur-fast),border-color var(--dur-fast); }
.skill-inspector > footer .secondary { flex:1;border:1px solid var(--color-rule-strong);background:var(--color-paper);color:var(--color-ink-2); }
.skill-inspector > footer .secondary:hover { border-color:var(--color-faint); }
.skill-inspector > footer :deep(.primary) { flex:1.5;border:0;background:var(--color-accent);color:var(--color-accent-ink); }
.skill-inspector > footer :deep(.primary:hover) { background:var(--color-accent-hover); }

@media (max-width: 640px) { .skill-inspector { top:auto;right:0;bottom:0;left:0;width:100%;max-height:85dvh;border-radius:var(--radius-xl) var(--radius-xl) 0 0; } }
</style>
