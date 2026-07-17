<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { CloseOutline, OpenOutline } from '@vicons/ionicons5';
import { AnimatePresence, motion } from 'motion-v';
import type { AgentInfo, SkillDetail, SkillInfo } from '../../api';
import AgentStack from './agent-stack.vue';
import DistributionPicker from './distribution-picker.vue';

const props = defineProps<{ skill: SkillInfo | null; detail: SkillDetail | null; agents: AgentInfo[]; loading?: boolean; busy?: boolean }>();
const emit = defineEmits<{
  close: [];
  preview: [skill: SkillInfo, input: { agents: string[]; mode: 'symlink' | 'copy' }];
  distribute: [skill: SkillInfo, input: { agents: string[]; mode: 'symlink' | 'copy' }];
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
      <motion.div v-if="skill" :key="skill.name" class="inspector-layer" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }" :transition="{ duration: .16 }">
        <button class="inspector-scrim" type="button" aria-label="关闭 Inspector" @click="emit('close')" />
        <motion.aside class="skill-inspector" aria-label="Skill Inspector" :initial="{ x: 34, opacity: 0, scale: .985 }" :animate="{ x: 0, opacity: 1, scale: 1 }" :exit="{ x: 24, opacity: 0, scale: .99 }" :transition="{ type: 'spring', stiffness: 470, damping: 38 }">
          <header><div class="inspector-identity"><span>{{ skill.name.split('/').at(-1)?.slice(0, 2).toUpperCase() }}</span><div><p>Skill 检查器</p><h2>{{ skill.name.split('/').at(-1) }}</h2><small>{{ skill.name }}</small></div></div><button type="button" aria-label="关闭" @click="emit('close')"><n-icon :component="CloseOutline" size="16" /></button></header>
          <div class="inspector-scroll">
            <section class="health-card"><i :class="skill.managed ? 'ok' : 'warning'" /><div><b>{{ skill.managed ? 'Skill 状态正常' : '需要关联来源' }}</b><span>{{ skill.agents.length ? `已分发至 ${skill.agents.length} 个 Agent` : '尚未配置分发目标' }}</span></div><em>{{ skill.managed ? '已纳管' : '待检查' }}</em></section>
            <section class="info-section"><div class="section-heading"><p>来源</p><span>{{ coreDetail?.source?.type === 'github' ? '远程' : '本地' }}</span></div><code>{{ source }}</code><small v-if="coreDetail?.source?.commit">提交 {{ coreDetail.source.commit.slice(0, 10) }}</small></section>
            <section class="info-section"><div class="section-heading"><p>版本</p><span>当前版本</span></div><div class="version-row"><b>v{{ skill.version }}</b><small>{{ coreDetail?.updatedAt ? new Date(coreDetail.updatedAt).toLocaleString() : loading ? '正在读取…' : '暂无更新时间' }}</small></div></section>
            <section class="info-section distribution-section"><div class="section-heading"><p>分发状态</p><span>{{ skill.agents.length }} / {{ installedAgents.length }}</span></div><div v-if="skill.agents.length" class="distribution-list"><div v-for="agentName in skill.agents" :key="agentName"><span><i />{{ agents.find(agent => agent.name === agentName)?.displayName ?? agentName }}</span><small>{{ coreDetail?.distribution?.find(item => item.agent === agentName)?.mode ?? '已连接' }}</small></div></div><div v-else class="empty-distribution"><span>还没有分发到任何 Agent</span><small>使用下方按钮添加第一个目标。</small></div><AgentStack v-if="skill.agents.length" :agent-names="skill.agents" :agents="agents" /></section>
            <section v-if="skill.tags.length" class="info-section"><div class="section-heading"><p>标签</p><span>{{ skill.tags.length }}</span></div><div class="tag-list"><span v-for="tag in skill.tags" :key="tag">{{ tag }}</span></div></section>
            <section v-if="coreDetail?.dependencies?.length" class="info-section"><div class="section-heading"><p>依赖</p><span>{{ coreDetail.dependencies.length }}</span></div><small>更新前可在完整详情中审查声明依赖。</small></section>
          </div>
          <footer><button class="secondary" type="button" @click="openDetails"><n-icon :component="OpenOutline" size="13" />完整详情</button><DistributionPicker :skill="skill" :agents="agents" :busy="busy" @preview="emit('preview', skill, $event)" @distribute="emit('distribute', skill, $event)"><button class="primary" type="button">{{ skill.agents.length ? '添加分发目标' : '开始分发' }}</button></DistributionPicker></footer>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<style scoped>
.inspector-layer { position: fixed; inset: 0; z-index: 70; pointer-events: none; }.inspector-scrim { position: absolute; inset: 0; border: 0; background: rgba(12,12,16,.13); pointer-events: auto; backdrop-filter: blur(1px); }.skill-inspector { position: absolute; top: calc(var(--toolbar-height) + .65rem); right: .7rem; bottom: calc(var(--statusbar-height) + .65rem); display: grid; width: min(23.5rem, calc(100vw - 1.4rem)); grid-template-rows: auto minmax(0,1fr) auto; overflow: hidden; border: 1px solid var(--color-rule-strong); border-radius: 1.05rem; background: var(--color-paper-raised); box-shadow: var(--shadow-lg); pointer-events: auto; backdrop-filter: saturate(140%) blur(32px); }.skill-inspector > header { display: flex; align-items: start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--color-rule); padding: .9rem; }.inspector-identity { display: flex; min-width: 0; gap: .65rem; }.inspector-identity > span { display: grid; width: 2.15rem; height: 2.15rem; flex: none; place-items: center; border: 1px solid var(--color-rule); border-radius: .65rem; background: linear-gradient(145deg, var(--color-paper), var(--color-paper-3)); color: var(--color-accent); font-family: var(--font-mono); font-size: .75rem; font-weight: 750; }.inspector-identity p,.section-heading p { margin: 0; color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; }.inspector-identity h2 { margin: .12rem 0 0; color: var(--color-ink); font-size: .86rem; font-weight: 650; letter-spacing: -.025em; }.inspector-identity small { display: block; overflow: hidden; max-width: 15rem; margin-top: .03rem; color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; }.skill-inspector > header > button { display: grid; width: 1.75rem; height: 1.75rem; place-items: center; border: 0; border-radius: .48rem; background: var(--color-paper-2); color: var(--color-muted); }.skill-inspector > header > button:hover { background: var(--color-paper-3); color: var(--color-ink); }
.inspector-scroll { display: grid; align-content: start; gap: .75rem; overflow: auto; padding: .85rem; }.health-card { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: .62rem; border: 1px solid var(--color-rule); border-radius: .7rem; background: var(--color-paper-2); padding: .65rem; }.health-card > i { width: .48rem; height: .48rem; border-radius: 999px; }.health-card > i.ok { background: var(--color-success); box-shadow: 0 0 0 4px var(--color-success-soft); }.health-card > i.warning { background: var(--color-warning); box-shadow: 0 0 0 4px var(--color-warning-soft); }.health-card b,.health-card span { display: block; }.health-card b { color: var(--color-ink); font-size: .75rem; }.health-card span { margin-top: .07rem; color: var(--color-muted); font-size: .75rem; }.health-card em { border-radius: 999px; background: var(--color-paper); padding: .18rem .38rem; color: var(--color-muted); font-family: var(--font-mono); font-size: .75rem; font-style: normal; }
.info-section { display: grid; gap: .48rem; padding: .68rem .12rem; border-bottom: 1px solid var(--color-rule); }.info-section:last-child { border-bottom: 0; }.section-heading { display: flex; align-items: center; justify-content: space-between; }.section-heading span { color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; }.info-section code { overflow-wrap: anywhere; color: var(--color-ink-2); font-family: var(--font-mono); font-size: .75rem; line-height: 1.5; }.info-section > small,.version-row small { color: var(--color-muted); font-size: .75rem; line-height: 1.45; }.version-row { display: flex; align-items: end; justify-content: space-between; gap: .5rem; }.version-row b { color: var(--color-ink); font-family: var(--font-mono); font-size: .82rem; }.distribution-list { display: grid; gap: .16rem; }.distribution-list > div { display: flex; align-items: center; justify-content: space-between; gap: .5rem; border-radius: .45rem; padding: .35rem .4rem; }.distribution-list > div:hover { background: var(--color-paper-2); }.distribution-list span { display: flex; align-items: center; gap: .4rem; color: var(--color-ink-2); font-size: .75rem; }.distribution-list span i { width: .36rem; height: .36rem; border-radius: 999px; background: var(--color-success); }.distribution-list small { color: var(--color-faint); font-family: var(--font-mono); font-size: .75rem; }.empty-distribution { display: grid; gap: .08rem; border: 1px dashed var(--color-rule-strong); border-radius: .55rem; padding: .65rem; }.empty-distribution span { color: var(--color-ink-2); font-size: .75rem; }.empty-distribution small { color: var(--color-muted); font-size: .75rem; }.tag-list { display: flex; flex-wrap: wrap; gap: .3rem; }.tag-list span { border: 1px solid var(--color-rule); border-radius: .35rem; background: var(--color-paper-2); padding: .16rem .32rem; color: var(--color-muted); font-family: var(--font-mono); font-size: .75rem; }
.skill-inspector > footer { display: flex; gap: .45rem; border-top: 1px solid var(--color-rule); padding: .75rem; }.skill-inspector > footer button { display: flex; min-height: 2rem; align-items: center; justify-content: center; gap: .35rem; border-radius: .5rem; padding: 0 .7rem; font-size: .75rem; font-weight: 600; }.skill-inspector > footer .secondary { flex: .85; border: 1px solid var(--color-rule); background: var(--color-paper); color: var(--color-ink-2); }.skill-inspector > footer :deep(.primary) { min-width: 10rem; border: 1px solid var(--color-accent); background: var(--color-accent); color: var(--color-accent-ink); }
@media (max-width: 640px) { .skill-inspector { top: auto; right: 0; bottom: 0; left: 0; width: 100%; max-height: 88dvh; border-radius: 1.15rem 1.15rem 0 0; }.inspector-scrim { background: rgba(12,12,16,.3); backdrop-filter: blur(4px); } }
.inspector-scrim { background:var(--color-inspector-scrim);backdrop-filter:none; }
.skill-inspector { width:min(28.5rem,calc(100vw - 2rem));border:1px solid var(--color-rule-strong);border-radius:1.15rem;background:var(--color-glass-strong);box-shadow:0 32px 90px rgba(15,15,20,.26),inset 0 1px 0 rgba(255,255,255,.24);backdrop-filter:saturate(185%) blur(46px);-webkit-backdrop-filter:saturate(185%) blur(46px); }
.skill-inspector>header { padding: 1.25rem; }.inspector-identity { gap: .85rem; }.inspector-identity>span { width: 2.7rem; height: 2.7rem; font-size: .75rem; }.inspector-identity h2 { margin-top:.2rem;font-size: 1.1rem; }.inspector-identity small { font-size: .75rem; }.inspector-identity p,.section-heading p,.section-heading span { font-size: .75rem; }
.inspector-scroll { gap: 1.1rem; padding: 1.25rem; }.health-card { gap: .9rem; padding: 1rem; }.health-card b { font-size: .9rem; }.health-card span { margin-top:.15rem;font-size: .8rem; }.health-card em { font-size: .75rem; }
.info-section { gap: .72rem; padding: 1rem .15rem; }.info-section code { font-size: .8rem; }.info-section>small,.version-row small,.distribution-list small { font-size: .76rem; }.version-row b { font-size:1rem; }.distribution-list span { font-size: .84rem; }.skill-inspector>footer { gap: .75rem; padding: 1.1rem; }.skill-inspector>footer button { min-height: 2.6rem; font-size: .84rem; }
</style>
