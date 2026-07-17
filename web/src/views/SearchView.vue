<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { useMessage } from "naive-ui";
import { CloudDownloadOutline, SearchOutline } from "@vicons/ionicons5";
import { api } from "../api";
import type { AgentInfo, SearchResult } from "../api";
import PageHeader from "../components/ui/PageHeader.vue";
import UiButton from "../components/ui/UiButton.vue";
import UiDialog from "../components/ui/UiDialog.vue";
import UiSelect from "../components/ui/UiSelect.vue";

const message = useMessage();
const query = shallowRef("");
const scope = shallowRef<"all" | "local" | "remote">("all");
const loading = ref(false);
const localResults = ref<SearchResult[]>([]);
const remoteResults = ref<SearchResult[]>([]);
const searched = shallowRef(false);
const installOpen = shallowRef(false);
const installing = ref(false);
const selected = ref<SearchResult | null>(null);
const agents = ref<AgentInfo[]>([]);
const deployTargets = ref<string[]>([]);
const mode = shallowRef<"symlink" | "copy">("symlink");
const deployAfterInstall = shallowRef(true);
const installDependencies = shallowRef(false);

const agentOptions = computed(() =>
  agents.value
    .filter((agent) => agent.installed)
    .map((agent) => ({ label: agent.displayName, value: agent.name })),
);

async function search() {
  const value = query.value.trim();
  if (!value) return;
  loading.value = true;
  searched.value = true;
  try {
    const result = await api.search(value, scope.value);
    localResults.value = result.local;
    remoteResults.value = result.remote;
  } catch (error) {
    message.error(`搜索失败: ${(error as Error).message}`);
  } finally {
    loading.value = false;
  }
}

async function openInstall(result: SearchResult) {
  selected.value = result;
  deployTargets.value = [];
  deployAfterInstall.value = true;
  installDependencies.value = false;
  installOpen.value = true;
  try {
    agents.value = (await api.getAgents()).agents;
  } catch {
    /* Installation can still run without deployment targets. */
  }
}

async function install() {
  if (!selected.value) return;
  installing.value = true;
  try {
    await api.installSkill({
      source: `${selected.value.source}/${selected.value.skillId}`,
      agents: deployAfterInstall.value ? deployTargets.value : [],
      mode: mode.value,
      noDeploy: !deployAfterInstall.value,
      installDeps: installDependencies.value,
    });
    message.success("Skill 已安装到中央仓库");
    installOpen.value = false;
  } catch (error) {
    message.error(`安装失败: ${(error as Error).message}`);
  } finally {
    installing.value = false;
  }
}
</script>

<template>
  <div class="app-page search-page">
    <PageHeader
      eyebrow="发现与安装"
      title="发现 Skill"
      summary="检索本地目录与 skills.sh，确认来源后再安装。"
      ><template #actions
        ><span class="review-hint">审查来源后再安装</span></template
      ></PageHeader
    >
    <section class="search-console">
      <div class="search-field">
        <n-icon :component="SearchOutline" size="16" /><input
          v-model="query"
          type="search"
          placeholder="输入 Skill 名、用途或关键词"
          autofocus
          @keyup.enter="search"
        /><button
          type="button"
          :disabled="loading || !query.trim()"
          @click="search"
        >
          {{ loading ? "搜索中…" : "搜索" }}
        </button>
      </div>
      <div class="scope-switch" aria-label="搜索范围">
        <button
          v-for="item in [
            { value: 'all', label: '全部来源' },
            { value: 'local', label: '仅本地' },
            { value: 'remote', label: 'skills.sh' },
          ]"
          :key="item.value"
          type="button"
          :class="{ active: scope === item.value }"
          @click="scope = item.value as typeof scope"
        >
          {{ item.label }}
        </button>
      </div>
    </section>
    <n-spin :show="loading"
      ><template v-if="searched"
        ><section v-if="localResults.length" class="result-section">
          <div class="section-title">
            <p class="meta-label">本地结果</p>
            <span>{{ localResults.length }} 项</span>
          </div>
          <article
            v-for="result in localResults"
            :key="`local:${result.skillId}`"
            class="result-row"
          >
            <span class="result-mark">{{
              result.name.slice(0, 2).toUpperCase()
            }}</span>
            <div>
              <h2>{{ result.name }}</h2>
              <p>{{ result.description || "未提供描述" }}</p>
            </div>
            <div class="result-meta">
              <code>{{
                result.localVersion ? `v${result.localVersion}` : "local"
              }}</code>
            </div>
          </article>
        </section>
        <section v-if="remoteResults.length" class="result-section">
          <div class="section-title">
            <p class="meta-label">远程结果</p>
            <span>{{ remoteResults.length }} 项</span>
          </div>
          <article
            v-for="result in remoteResults"
            :key="`${result.source}:${result.skillId}`"
            class="result-row"
          >
            <span class="result-mark">{{
              result.name.slice(0, 2).toUpperCase()
            }}</span>
            <div>
              <h2>{{ result.name }}</h2>
              <code>{{ result.source }}/{{ result.skillId }}</code>
              <p>{{ result.description || "未提供描述" }}</p>
            </div>
            <div class="result-actions">
              <span v-if="result.stars !== undefined">★ {{ result.stars }}</span
              ><n-button
                size="small"
                type="primary"
                @click="openInstall(result)"
                ><template #icon
                  ><n-icon :component="CloudDownloadOutline" /></template
                >安装</n-button
              >
            </div>
          </article>
        </section>
        <div
          v-if="localResults.length === 0 && remoteResults.length === 0"
          class="empty-state"
        >
          <b>没有匹配结果</b><span>尝试更短的关键词或切换搜索范围。</span>
        </div></template
      >
      <div v-else class="empty-state">
        <span class="empty-glyph"
          ><n-icon :component="SearchOutline" size="20" /></span
        ><b>从一个关键词开始</b><span>例如 pdf、browser、vue 或 testing</span>
      </div></n-spin
    >
    <UiDialog v-model="installOpen" title="安装 Skill" size="sm">
      <div v-if="selected" class="install-form">
        <p class="install-name">{{ selected.name }}</p>
        <code>{{ selected.source }}/{{ selected.skillId }}</code
        ><n-switch v-model:value="deployAfterInstall">安装后立即分发</n-switch
        ><UiSelect
          v-if="deployAfterInstall"
          v-model="deployTargets"
          :options="agentOptions"
          multiple
          placeholder="选择分发目标（可稍后处理）"
        /><n-radio-group v-if="deployAfterInstall" v-model:value="mode"
          ><n-radio value="symlink">符号链接</n-radio
          ><n-radio value="copy">复制副本</n-radio></n-radio-group
        ><n-checkbox v-model:checked="installDependencies"
          >明确安装 Skill 声明的包依赖</n-checkbox
        >
        <p class="install-note">
          默认不会安装 npm/pip 包依赖；勾选后仍只会执行 SKILL.md
          中已持久化的声明。
        </p>
        <UiButton variant="primary" :loading="installing" block @click="install">确认安装</UiButton>
      </div>
    </UiDialog>
  </div>
</template>

<style scoped>
.discover-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}
.discover-head > span {
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.search-console {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--color-rule);
  border-radius: 0.78rem;
  background: var(--color-paper);
  padding: 0.55rem;
  box-shadow: var(--shadow-xs);
}
.search-field {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid var(--color-rule);
  border-radius: 0.56rem;
  background: var(--color-paper-2);
  padding: 0.25rem 0.3rem 0.25rem 0.65rem;
  color: var(--color-muted);
}
.search-field input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-size: 0.75rem;
}
.search-field button {
  min-height: 1.9rem;
  border: 1px solid var(--color-accent);
  border-radius: 0.43rem;
  background: var(--color-accent);
  padding: 0 0.8rem;
  color: var(--color-accent-ink);
  font-size: 0.75rem;
  font-weight: 650;
}
.search-field button:disabled {
  opacity: 0.45;
}
.scope-switch {
  display: flex;
  flex: none;
  border: 1px solid var(--color-rule);
  border-radius: 0.5rem;
  background: var(--color-paper-2);
  padding: 0.16rem;
}
.scope-switch button {
  min-height: 1.7rem;
  border: 0;
  border-radius: 0.36rem;
  background: transparent;
  padding: 0 0.55rem;
  color: var(--color-muted);
  font-size: 0.75rem;
}
.scope-switch button.active {
  background: var(--color-paper);
  color: var(--color-ink);
  box-shadow: var(--shadow-xs);
}
.result-section {
  display: grid;
  gap: 0.4rem;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.1rem;
}
.section-title span {
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
.result-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--color-rule);
  border-radius: 0.68rem;
  background: var(--color-paper);
  padding: 0.65rem 0.72rem;
  box-shadow: var(--shadow-xs);
}
.result-mark {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--color-rule);
  border-radius: 0.55rem;
  background: var(--color-paper-2);
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
}
.result-row h2 {
  margin: 0;
  color: var(--color-ink);
  font-size: 0.75rem;
}
.result-row p {
  margin: 0.15rem 0 0;
  color: var(--color-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}
.result-row code,
.install-form code {
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
.result-actions,
.result-meta {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.55rem;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
.empty-state {
  display: grid;
  min-height: 13rem;
  place-content: center;
  justify-items: center;
  gap: 0.25rem;
  color: var(--color-muted);
  text-align: center;
}
.empty-state b {
  color: var(--color-ink-2);
  font-size: 0.75rem;
}
.empty-state span {
  font-size: 0.75rem;
}
.empty-glyph {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  margin-bottom: 0.3rem;
  place-items: center;
  border: 1px solid var(--color-rule);
  border-radius: 0.7rem;
  background: var(--color-paper);
}
.install-modal {
  max-inline-size: 34rem;
}
.install-form {
  display: grid;
  gap: var(--space-md);
}
.install-name,
.install-note {
  margin: 0;
}
.install-name {
  color: var(--color-ink);
  font-size: var(--text-lg);
  font-weight: 600;
}
.install-note {
  color: var(--color-muted);
  font-size: var(--text-xs);
}
@media (max-width: 46rem) {
  .search-console {
    align-items: stretch;
    flex-direction: column;
  }
  .scope-switch {
    align-self: start;
  }
}
@media (max-width: 39.99rem) {
  .result-row {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .result-actions,
  .result-meta {
    grid-column: 2;
    justify-content: space-between;
  }
}
</style>
