<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import {
  GridOutline,
  ListOutline,
  RefreshOutline,
  SearchOutline,
} from "@vicons/ionicons5";
import { useToast } from "../composables/useToast";
import { api } from "../api";
import type { AgentInfo, SkillInfo } from "../api";
import AgentStack from "../components/workspace/agent-stack.vue";
import DistributionPicker from "../components/workspace/distribution-picker.vue";
import PageHeader from "../components/ui/PageHeader.vue";
import UiButton from "../components/ui/UiButton.vue";
import UiSegmented from "../components/ui/UiSegmented.vue";
import UiSpin from "../components/ui/UiSpin.vue";
import UiIcon from '../components/ui/UiIcon.vue';

type DistributionInput = { add: string[]; remove: string[]; mode: "symlink" | "copy" };
const message = useToast();
const skills = ref<SkillInfo[]>([]);
const agents = ref<AgentInfo[]>([]);
const loading = ref(false);
const runningSkill = shallowRef<string | null>(null);
const query = shallowRef("");
const perspective = ref("skill");
const perspectiveOptions = [
  { value: "skill", label: "按 Skill", icon: GridOutline },
  { value: "agent", label: "按 Agent", icon: ListOutline },
  { value: "matrix", label: "关系图" },
];
const installedAgents = computed(() =>
  agents.value.filter((agent) => agent.installed),
);
const visibleSkills = computed(() => {
  const value = query.value.trim().toLowerCase();
  return value
    ? skills.value.filter((skill) =>
        `${skill.name} ${skill.description}`.toLowerCase().includes(value),
      )
    : skills.value;
});
const activeLinks = computed(() =>
  skills.value.reduce((count, skill) => count + skill.agents.length, 0),
);
const coverage = computed(() => {
  const total = skills.value.length * installedAgents.value.length;
  return total ? Math.round((activeLinks.value / total) * 100) : 0;
});
const skillsForAgent = (name: string) =>
  skills.value.filter((skill) => skill.agents.includes(name));
const skillDisplayName = (name: string) => name.split("/").at(-1) ?? name;
const skillNamespace = (name: string) => {
  const index = name.lastIndexOf("/");
  return index === -1 ? "本地工作区" : name.slice(0, index);
};

async function refresh() {
  loading.value = true;
  try {
    const [skillResponse, agentResponse] = await Promise.all([
      api.getSkills(),
      api.getAgents(),
    ]);
    skills.value = skillResponse.skills;
    agents.value = agentResponse.agents;
  } catch (error) {
    message.error(`加载分发状态失败: ${(error as Error).message}`);
  } finally {
    loading.value = false;
  }
}
async function distribute(
  skill: SkillInfo,
  input: DistributionInput,
) {
  runningSkill.value = skill.name;
  try {
    if (input.add.length) await api.deploySkill(skill.name, input.add, { mode: input.mode });
    if (input.remove.length) await api.undeploySkill(skill.name, input.remove);
    const parts: string[] = [];
    if (input.add.length) parts.push(`新增 ${input.add.length}`);
    if (input.remove.length) parts.push(`移除 ${input.remove.length}`);
    message.success(`分发已更新（${parts.join("，")}）`);
    await refresh();
  } catch (error) {
    message.error(`分发失败: ${(error as Error).message}`);
  } finally {
    runningSkill.value = null;
  }
}
refresh();
</script>

<template>
  <div class="distribution-workspace">
    <PageHeader
      eyebrow="分发管理"
      title="分发工作区"
      summary="从 Skill 或 Agent 两个视角检查覆盖关系。"
      ><template #actions
        ><UiButton size="sm" :loading="loading" @click="refresh"
          ><template #icon
            ><UiIcon :component="RefreshOutline" size="16" /></template
          >刷新</UiButton
        ></template
      ></PageHeader
    >
    <section class="distribution-toolbar">
      <UiSegmented v-model="perspective" :options="perspectiveOptions" size="lg" />
      <label
        ><UiIcon :component="SearchOutline" size="13" /><input
          v-model="query"
          placeholder="筛选 Skill"
      /></label>
    </section>
    <section class="distribution-metrics">
      <article>
        <span>有效关系</span><b>{{ activeLinks }}</b
        ><small>当前分发链接</small>
      </article>
      <article>
        <span>覆盖率</span><b>{{ coverage }}%</b><small>当前 Agent 覆盖</small>
      </article>
      <article>
        <span>可用 Agent</span><b>{{ installedAgents.length }}</b
        ><small>可用分发目标</small>
      </article>
      <article>
        <span>技能数量</span><b>{{ skills.length }}</b
        ><small>中央仓库项目</small>
      </article>
    </section>
    <UiSpin :show="loading">
      <section v-if="perspective === 'skill'" class="skill-distribution-list">
        <article v-for="skill in visibleSkills" :key="skill.name">
          <div class="skill-symbol">
            {{ skill.name.split("/").at(-1)?.slice(0, 2).toUpperCase() }}
          </div>
          <div class="skill-copy">
            <b>{{ skill.name.split("/").at(-1) }}</b
            ><span>{{
              skill.name.includes("/")
                ? skill.name.slice(0, skill.name.lastIndexOf("/"))
                : "本地工作区"
            }}</span>
          </div>
          <div class="coverage-copy">
            <AgentStack
              v-if="skill.agents.length"
              :agent-names="skill.agents"
              :agents="agents"
            /><span v-else>尚未分发</span
            ><small
              >{{ skill.agents.length }} / {{ installedAgents.length }}</small
            >
          </div>
          <DistributionPicker
            :skill="skill"
            :agents="agents"
            :busy="runningSkill === skill.name"
            @distribute="distribute(skill, $event)"
            ><button class="add-target" type="button">
              ＋ <span>添加目标</span>
            </button></DistributionPicker
          >
        </article>
      </section>
      <section v-else-if="perspective === 'agent'" class="agent-grid">
        <article v-for="agent in installedAgents" :key="agent.name">
          <header>
            <div class="agent-symbol">
              {{ agent.displayName.slice(0, 2).toUpperCase() }}
            </div>
            <div>
              <b>{{ agent.displayName }}</b
              ><code>{{ agent.skillsDir }}</code>
            </div>
            <i />
          </header>
          <div class="agent-count">
            <strong>{{ skillsForAgent(agent.name).length }}</strong
            ><span>已分发 Skill</span>
          </div>
          <div class="agent-skills">
            <span
              v-for="skill in skillsForAgent(agent.name).slice(0, 6)"
              :key="skill.name"
              >{{ skill.name.split("/").at(-1) }}</span
            ><em v-if="skillsForAgent(agent.name).length > 6"
              >+{{ skillsForAgent(agent.name).length - 6 }}</em
            ><small v-if="!skillsForAgent(agent.name).length">暂无分发</small>
          </div>
        </article>
      </section>
      <section v-else class="relation-matrix">
        <header class="matrix-guide">
          <div>
            <b>全局覆盖关系</b>
            <span>Skill 名称固定在左侧，横向滚动查看全部 Agent</span>
          </div>
          <em>{{ visibleSkills.length }} Skills × {{ installedAgents.length }} Agents</em>
        </header>
        <div
          class="matrix-scroll"
          :style="{ '--agent-count': installedAgents.length }"
        >
          <div class="matrix-table">
            <div class="matrix-head">
              <span class="matrix-skill-heading">Skill</span>
              <span
                v-for="agent in installedAgents"
                :key="agent.name"
                class="matrix-agent-heading"
                :title="agent.displayName"
              >
                <i>{{ agent.displayName.slice(0, 2).toUpperCase() }}</i>
                <b>{{ agent.displayName }}</b>
              </span>
            </div>
            <div
              v-for="skill in visibleSkills"
              :key="skill.name"
              class="matrix-row"
            >
              <strong class="matrix-skill" :title="skill.name">
                <b>{{ skillDisplayName(skill.name) }}</b>
                <small>{{ skillNamespace(skill.name) }}</small>
              </strong>
              <span
                v-for="agent in installedAgents"
                :key="agent.name"
                class="matrix-cell"
                :class="{ active: skill.agents.includes(agent.name) }"
                :title="`${skill.name} → ${agent.displayName}: ${skill.agents.includes(agent.name) ? '已分发' : '未分发'}`"
              >
                <i />
                <em>{{ skill.agents.includes(agent.name) ? "已分发" : "未分发" }}</em>
              </span>
            </div>
          </div>
        </div>
      </section>
    </UiSpin>
  </div>
</template>

<style scoped>
.distribution-workspace {
  width: 100%;
  max-width: 96rem;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 3rem;
}
.distribution-workspace > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}
.distribution-workspace > header p {
  margin: 0;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 650;
  letter-spacing: 0.1em;
}
.distribution-workspace > header h1 {
  margin: 0.28rem 0 0;
  color: var(--color-ink);
  font-size: 1.45rem;
  letter-spacing: -0.045em;
}
.distribution-workspace > header span {
  display: block;
  margin-top: 0.3rem;
  color: var(--color-muted);
  font-size: 0.75rem;
}
.distribution-workspace > header button {
  display: flex;
  height: 1.95rem;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-sm);
  background: var(--color-paper);
  padding: 0 0.62rem;
  color: var(--color-ink-2);
  font-size: 0.75rem;
  box-shadow: var(--shadow-xs);
}
.distribution-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1.1rem;
}
.distribution-toolbar > label {
  display: flex;
  width: min(20rem, 40vw);
  height: 2rem;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-sm);
  background: var(--color-paper);
  padding: 0 0.55rem;
  color: var(--color-muted);
}
.distribution-toolbar input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: none;
  color: var(--color-ink);
  font-size: 0.75rem;
}
.distribution-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-top: 0.8rem;
  overflow: hidden;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-lg);
  background: var(--color-paper);
  box-shadow: var(--shadow-xs);
}
.distribution-metrics article {
  display: grid;
  gap: 0.12rem;
  padding: 0.72rem 0.85rem;
  border-right: 1px solid var(--color-rule);
}
.distribution-metrics article:last-child {
  border-right: 0;
}
.distribution-metrics span {
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.07em;
}
.distribution-metrics b {
  color: var(--color-ink);
  font-size: 1.15rem;
  letter-spacing: -0.04em;
}
.distribution-metrics small {
  color: var(--color-muted);
  font-size: 0.75rem;
}
.skill-distribution-list {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.75rem;
}
.skill-distribution-list > article {
  display: grid;
  min-height: 3.8rem;
  grid-template-columns: auto minmax(10rem, 1fr) minmax(12rem, auto) auto;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-md);
  background: var(--color-paper);
  padding: 0.55rem 0.65rem;
  box-shadow: var(--shadow-xs);
}
.skill-distribution-list > article:hover {
  border-color: var(--color-rule-strong);
}
.skill-symbol,
.agent-symbol {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-sm);
  background: var(--color-paper-2);
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 750;
}
.skill-copy b,
.skill-copy span {
  display: block;
}
.skill-copy b {
  overflow: hidden;
  color: var(--color-ink);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.skill-copy span {
  overflow: hidden;
  margin-top: 0.06rem;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.coverage-copy {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}
.coverage-copy > span {
  color: var(--color-faint);
  font-size: 0.75rem;
}
.coverage-copy small {
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
.add-target {
  display: flex;
  height: 1.75rem;
  align-items: center;
  gap: 0.25rem;
  border: 1px dashed var(--color-rule-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  padding: 0 0.48rem;
  color: var(--color-muted);
  font-size: 0.75rem;
}
.add-target:hover {
  border-style: solid;
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent);
}
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.6rem;
  margin-top: 0.75rem;
}
.agent-grid > article {
  display: grid;
  gap: 0.85rem;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-lg);
  background: var(--color-paper);
  padding: 0.85rem;
  box-shadow: var(--shadow-xs);
}
.agent-grid header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
}
.agent-grid header b,
.agent-grid header code {
  display: block;
}
.agent-grid header b {
  color: var(--color-ink);
  font-size: 0.75rem;
}
.agent-grid header code {
  overflow: hidden;
  margin-top: 0.08rem;
  color: var(--color-faint);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agent-grid header > i {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: var(--color-success);
  box-shadow: 0 0 0 3px var(--color-success-soft);
}
.agent-count {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}
.agent-count strong {
  color: var(--color-ink);
  font-size: 1.35rem;
  letter-spacing: -0.05em;
}
.agent-count span {
  color: var(--color-muted);
  font-size: 0.75rem;
}
.agent-skills {
  display: flex;
  min-height: 2.3rem;
  flex-wrap: wrap;
  align-content: start;
  gap: 0.25rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--color-rule);
}
.agent-skills span,
.agent-skills em {
  border-radius: var(--radius-xs);
  background: var(--color-paper-2);
  padding: 0.16rem 0.3rem;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-style: normal;
}
.agent-skills small {
  color: var(--color-faint);
  font-size: 0.75rem;
}
.relation-matrix {
  margin-top: 1rem;
  overflow: hidden;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-lg);
  background: var(--color-paper);
  box-shadow: var(--shadow-xs);
}
.matrix-guide {
  display: flex;
  min-height: 4.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid var(--color-rule);
  padding: 0.85rem 1rem;
  background: var(--color-paper);
}
.matrix-guide b,
.matrix-guide span {
  display: block;
}
.matrix-guide b {
  color: var(--color-ink);
  font-size: 0.9rem;
}
.matrix-guide span {
  margin-top: 0.16rem;
  color: var(--color-muted);
  font-size: 0.8rem;
}
.matrix-guide em {
  border: 1px solid var(--color-rule);
  border-radius: 999px;
  background: var(--color-paper-2);
  padding: 0.3rem 0.55rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-style: normal;
  white-space: nowrap;
}
.matrix-scroll {
  max-height: min(44rem, calc(100dvh - 21rem));
  overflow: auto;
  overscroll-behavior: contain;
}
.matrix-table {
  width: max-content;
  min-width: 100%;
}
.matrix-head,
.matrix-row {
  display: grid;
  grid-template-columns: 20rem repeat(var(--agent-count), 8rem);
}
.matrix-head {
  position: sticky;
  top: 0;
  z-index: 4;
  background: var(--color-paper-2);
  box-shadow: 0 1px 0 var(--color-rule), 0 5px 14px rgba(15, 15, 20, 0.04);
}
.matrix-head span,
.matrix-row > * {
  border-right: 1px solid var(--color-rule);
  border-bottom: 1px solid var(--color-rule);
}
.matrix-head span {
  display: flex;
  min-width: 0;
  min-height: 3.25rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.matrix-skill-heading {
  position: sticky;
  left: 0;
  z-index: 5;
  background: var(--color-paper-2);
}
.matrix-agent-heading i {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  flex: none;
  place-items: center;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-sm);
  background: var(--color-paper-3);
  color: var(--color-accent);
  font-size: 0.75rem;
  font-style: normal;
  letter-spacing: 0;
}
.matrix-agent-heading b {
  overflow: hidden;
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.matrix-row {
  min-height: 3.5rem;
  background: var(--color-paper);
}
.matrix-row:hover {
  background: color-mix(in srgb, var(--color-accent-soft) 38%, var(--color-paper));
}
.matrix-skill {
  position: sticky;
  left: 0;
  z-index: 2;
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 0.55rem 0.85rem;
  background: var(--color-paper);
  box-shadow: 1px 0 0 var(--color-rule), 8px 0 18px rgba(15, 15, 20, 0.025);
}
.matrix-row:hover .matrix-skill {
  background: color-mix(in srgb, var(--color-accent-soft) 38%, var(--color-paper));
}
.matrix-skill b {
  overflow: hidden;
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.matrix-skill small {
  overflow: hidden;
  margin-top: 0.08rem;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 450;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.matrix-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  padding: 0.55rem 0.65rem;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
.matrix-cell i {
  width: 0.42rem;
  height: 0.42rem;
  flex: none;
  border-radius: 999px;
  background: var(--color-rule-strong);
}
.matrix-cell em {
  font-style: normal;
}
.matrix-cell.active {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success-soft) 45%, transparent);
}
.matrix-cell.active i {
  background: var(--color-success);
  box-shadow: 0 0 0 3px var(--color-success-soft);
}
@media (max-width: 720px) {
  .distribution-workspace {
    padding: 1rem 0.9rem 2.5rem;
  }
  .distribution-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .distribution-toolbar > label {
    width: 100%;
  }
  .distribution-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
  .distribution-metrics article:nth-child(2) {
    border-right: 0;
  }
  .distribution-metrics article:nth-child(-n + 2) {
    border-bottom: 1px solid var(--color-rule);
  }
  .skill-distribution-list > article {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .coverage-copy {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
  .add-target span {
    display: none;
  }
}

.distribution-workspace {
  max-width: var(--content-max-width);
  padding: 2rem 2.25rem 4rem;
}
.distribution-toolbar {
  margin-top: 1.5rem;
}
.distribution-toolbar > label {
  height: 2.4rem;
}
.distribution-toolbar input {
  font-size: 0.78rem;
}
.distribution-metrics {
  margin-top: 1.1rem;
}
.distribution-metrics article {
  gap: 0.25rem;
  padding: 1rem 1.1rem;
}
.distribution-metrics span {
  font-size: 0.75rem;
}
.distribution-metrics b {
  font-size: 1.35rem;
}
.distribution-metrics small {
  font-size: 0.75rem;
}
.skill-distribution-list {
  gap: 0.55rem;
  margin-top: 1rem;
}
.skill-distribution-list > article {
  min-height: 4.4rem;
  gap: 1rem;
  padding: 0.7rem 0.85rem;
}
.skill-symbol,
.agent-symbol {
  width: 2.35rem;
  height: 2.35rem;
  font-size: 0.75rem;
}
.skill-copy span,
.coverage-copy > span,
.coverage-copy small,
.add-target {
  font-size: 0.75rem;
}
.agent-grid {
  gap: 1rem;
  margin-top: 1rem;
}
.agent-grid > article {
  gap: 1rem;
  padding: 1rem;
}
.distribution-workspace > header p {
  font-size: 0.75rem;
}
.distribution-workspace > header h1 {
  font-size: 2rem;
}
.distribution-workspace > header span {
  font-size: 0.95rem;
}
.distribution-workspace > header button {
  height: 2.4rem;
  padding: 0 0.8rem;
  font-size: 0.85rem;
}
.distribution-toolbar input {
  font-size: 0.9rem;
}
.distribution-metrics span {
  font-size: 0.75rem;
}
.distribution-metrics b {
  font-size: 1.55rem;
}
.distribution-metrics small {
  font-size: 0.8rem;
}
.skill-distribution-list > article {
  min-height: 5rem;
}
.skill-copy b {
  font-size: 0.9rem;
}
.skill-copy span,
.coverage-copy > span,
.coverage-copy small,
.add-target {
  font-size: 0.78rem;
}
.add-target {
  height: 2.25rem;
  padding: 0 0.65rem;
}
.agent-grid header b {
  font-size: 0.9rem;
}
.agent-grid header code {
  font-size: 0.75rem;
}
.agent-count span,
.agent-skills small {
  font-size: 0.78rem;
}
.agent-skills span,
.agent-skills em {
  font-size: 0.75rem;
}
.matrix-head span,
.matrix-row span,
.matrix-row strong {
  font-size: 0.75rem;
}
</style>
