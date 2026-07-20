<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { CloudDownloadOutline, SearchOutline } from "@vicons/ionicons5";
import { useToast } from "../composables/useToast";
import { api } from "../api";
import type { AgentInfo, SearchResult } from "../api";
import PageHeader from "../components/ui/PageHeader.vue";
import UiButton from "../components/ui/UiButton.vue";
import UiCheckbox from "../components/ui/UiCheckbox.vue";
import UiDialog from "../components/ui/UiDialog.vue";
import UiRadio from "../components/ui/UiRadio.vue";
import UiRadioGroup from "../components/ui/UiRadioGroup.vue";
import UiSegmented from "../components/ui/UiSegmented.vue";
import UiSelect from "../components/ui/UiSelect.vue";
import UiSpin from "../components/ui/UiSpin.vue";
import UiSwitch from "../components/ui/UiSwitch.vue";
import UiIcon from '../components/ui/UiIcon.vue';

const message = useToast();
const query = shallowRef("");
const scope = ref("all");
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

const suggestions = ["pdf", "browser", "vue", "testing", "code-review", "design"];
const scopeOptions = [
  { value: "all", label: "全部" },
  { value: "local", label: "本地" },
  { value: "remote", label: "skills.sh" },
];

const agentOptions = computed(() =>
  agents.value
    .filter((agent) => agent.installed)
    .map((agent) => ({ label: agent.displayName, value: agent.name })),
);

async function search(keyword?: string) {
  const value = (keyword ?? query.value).trim();
  if (!value) return;
  if (keyword) query.value = keyword;
  loading.value = true;
  searched.value = true;
  try {
    const result = await api.search(value, scope.value as "all" | "local" | "remote");
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
  <div class="search-page">
    <PageHeader title="发现 Skill" summary="检索本地目录与 skills.sh，确认来源后再安装。" />

    <section class="search-bar">
      <label class="search-input">
        <UiIcon :component="SearchOutline" size="15" />
        <input v-model="query" type="search" placeholder="搜索 Skill 名称或关键词…" @keyup.enter="search()" />
      </label>
      <UiSegmented v-model="scope" :options="scopeOptions" size="md" />
      <UiButton size="sm" variant="primary" :loading="loading" :disabled="!query.trim()" @click="search()">搜索</UiButton>
    </section>

    <UiSpin :show="loading">
      <template v-if="searched">
        <section v-if="localResults.length" class="result-section">
          <div class="section-label"><span>本地结果</span><em>{{ localResults.length }}</em></div>
          <div class="result-list">
            <article v-for="result in localResults" :key="`local:${result.skillId}`" class="result-row">
              <span class="result-glyph">{{ result.name.slice(0, 2).toUpperCase() }}</span>
              <div class="result-body">
                <h2>{{ result.name }}</h2>
                <p>{{ result.description || "未提供描述" }}</p>
              </div>
              <code class="result-version">{{ result.localVersion ? `v${result.localVersion}` : "local" }}</code>
            </article>
          </div>
        </section>

        <section v-if="remoteResults.length" class="result-section">
          <div class="section-label"><span>远程结果</span><em>{{ remoteResults.length }}</em></div>
          <div class="result-list">
            <article v-for="result in remoteResults" :key="`${result.source}:${result.skillId}`" class="result-row">
              <span class="result-glyph">{{ result.name.slice(0, 2).toUpperCase() }}</span>
              <div class="result-body">
                <h2>{{ result.name }}</h2>
                <p class="result-source">{{ result.source }}/{{ result.skillId }}</p>
                <p>{{ result.description || "未提供描述" }}</p>
              </div>
              <div class="result-actions">
                <span v-if="result.stars !== undefined" class="result-stars">★ {{ result.stars }}</span>
                <UiButton size="sm" variant="primary" @click="openInstall(result)">安装</UiButton>
              </div>
            </article>
          </div>
        </section>

        <div v-if="!localResults.length && !remoteResults.length" class="empty-state">
          <b>没有匹配结果</b>
          <p>尝试更短的关键词或切换搜索范围</p>
        </div>
      </template>

      <div v-else class="empty-state">
        <div class="empty-icon"><UiIcon :component="SearchOutline" size="22" /></div>
        <b>从一个关键词开始</b>
        <p>搜索本地已安装的 Skill 或从 skills.sh 发现新的</p>
        <div class="suggestion-chips">
          <button v-for="word in suggestions" :key="word" type="button" @click="search(word)">{{ word }}</button>
        </div>
      </div>
    </UiSpin>

    <UiDialog v-model="installOpen" title="安装 Skill" size="sm">
      <div v-if="selected" class="install-form">
        <p class="install-name">{{ selected.name }}</p>
        <code class="install-path">{{ selected.source }}/{{ selected.skillId }}</code>
        <label class="switch-line"><UiSwitch v-model="deployAfterInstall" aria-label="安装后立即分发" />安装后立即分发</label>
        <UiSelect v-if="deployAfterInstall" v-model="deployTargets" :options="agentOptions" multiple placeholder="选择分发目标（可稍后处理）" />
        <UiRadioGroup v-if="deployAfterInstall" v-model="mode">
          <UiRadio value="symlink">符号链接</UiRadio>
          <UiRadio value="copy">复制副本</UiRadio>
        </UiRadioGroup>
        <UiCheckbox v-model="installDependencies">安装 Skill 声明的包依赖</UiCheckbox>
        <p class="install-note">默认不会安装 npm/pip 包依赖；勾选后只会执行 SKILL.md 中已声明的。</p>
        <UiButton variant="primary" :loading="installing" block @click="install">确认安装</UiButton>
      </div>
    </UiDialog>
  </div>
</template>

<style scoped>
.search-page { width:100%;max-width:var(--content-max-width);margin:0 auto;padding:1.75rem 2rem 3rem; }

.search-bar { display:flex;align-items:center;gap:.625rem;margin-top:1.25rem; }
.search-input { display:flex;flex:1;max-width:28rem;height:2.25rem;align-items:center;gap:.5rem;border:1px solid var(--color-rule-strong);border-radius:var(--radius-sm);background:var(--color-paper);padding:0 .75rem;color:var(--color-faint);transition:border-color var(--dur-fast),box-shadow var(--dur-fast); }
.search-input:focus-within { border-color:var(--color-accent);box-shadow:0 0 0 3px var(--color-focus-ring); }
.search-input input { min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--color-ink);font-size:var(--text-sm); }
.search-input input::placeholder { color:var(--color-faint); }


.result-section { margin-top:1.75rem; }
.section-label { display:flex;align-items:center;gap:.5rem;margin-bottom:.625rem; }
.section-label span { color:var(--color-ink);font-size:var(--text-sm);font-weight:600; }
.section-label em { color:var(--color-faint);font-family:var(--font-mono);font-size:var(--text-xs);font-style:normal; }

.result-list { display:grid; }
.result-row { display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.75rem;padding:.75rem .25rem;border-bottom:1px solid var(--color-rule);transition:background var(--dur-fast); }
.result-row:last-child { border-bottom:0; }
.result-row:hover { background:var(--color-paper-2);border-radius:var(--radius-sm); }

.result-glyph { display:grid;width:2rem;height:2rem;flex:none;place-items:center;border-radius:var(--radius-sm);background:var(--color-accent-soft);color:var(--color-accent);font-family:var(--font-mono);font-size:var(--text-xs);font-weight:700; }
.result-body { min-width:0; }
.result-body h2 { margin:0;color:var(--color-ink);font-size:var(--text-base);font-weight:600;letter-spacing:-.01em; }
.result-body p { margin:.125rem 0 0;color:var(--color-muted);font-size:var(--text-sm);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.result-source { color:var(--color-faint) !important;font-family:var(--font-mono);font-size:var(--text-xs) !important; }
.result-version { color:var(--color-faint);font-family:var(--font-mono);font-size:var(--text-xs); }
.result-actions { display:flex;align-items:center;gap:.625rem; }
.result-stars { color:var(--color-faint);font-size:var(--text-xs); }

.empty-state { display:grid;min-height:16rem;place-content:center;justify-items:center;gap:.375rem;text-align:center; }
.empty-icon { display:grid;width:2.75rem;height:2.75rem;margin-bottom:.5rem;place-items:center;border-radius:var(--radius-md);background:var(--color-paper-2);color:var(--color-faint); }
.empty-state b { color:var(--color-ink);font-size:var(--text-base);font-weight:600; }
.empty-state p { margin:0;color:var(--color-muted);font-size:var(--text-sm); }

.suggestion-chips { display:flex;flex-wrap:wrap;gap:.375rem;margin-top:.875rem;justify-content:center; }
.suggestion-chips button { border:1px solid var(--color-rule-strong);border-radius:999px;background:var(--color-paper);padding:.3rem .75rem;color:var(--color-ink-2);font-size:var(--text-xs);font-weight:500;font-family:var(--font-mono);transition:border-color var(--dur-fast),background var(--dur-fast); }
.suggestion-chips button:hover { border-color:var(--color-accent);background:var(--color-accent-soft);color:var(--color-accent); }

.install-form { display:grid;gap:var(--space-md); }
.install-name { margin:0;color:var(--color-ink);font-size:var(--text-lg);font-weight:650; }
.install-path { color:var(--color-faint);font-family:var(--font-mono);font-size:var(--text-xs);overflow-wrap:anywhere; }
.install-note { margin:0;color:var(--color-muted);font-size:var(--text-xs);line-height:1.5; }

@media (max-width: 760px) { .search-page { padding:1.25rem 1rem 2rem; }.search-bar { flex-wrap:wrap; }.search-input { max-width:100%;flex-basis:100%; } }
</style>
