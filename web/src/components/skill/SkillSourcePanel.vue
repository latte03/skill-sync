<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { LinkOutline, SearchOutline } from '@vicons/ionicons5';
import { api } from '../../api';
import type { SourceCandidate, SkillSource } from '../../api';

const props = defineProps<{ name: string; source: SkillSource }>();
const emit = defineEmits<{ associated: [] }>();
const message = useMessage();
const candidates = ref<SourceCandidate[]>([]);
const selected = ref<SourceCandidate | null>(null);
const loading = ref(false);
const verifying = ref(false);
const associating = ref(false);
const verifiedSummary = ref<string>('');
const sourceLabel = computed(() => props.source.type === 'github'
  ? `${props.source.owner}/${props.source.repo}${props.source.skillPath ? ` · ${props.source.skillPath}` : ''}`
  : '仅本地 · 尚未关联远程来源');

function toInput(candidate: SourceCandidate) {
  return { source: candidate.source, skillId: candidate.skillId, repo: candidate.repo, candidateName: candidate.name };
}

async function discover() {
  loading.value = true;
  selected.value = null;
  verifiedSummary.value = '';
  try { candidates.value = (await api.getSourceCandidates(props.name)).candidates; }
  catch (error) { message.error(`查找来源失败: ${(error as Error).message}`); }
  finally { loading.value = false; }
}

async function verify(candidate: SourceCandidate) {
  verifying.value = true;
  selected.value = candidate;
  verifiedSummary.value = '';
  try {
    const { verified } = await api.verifySourceCandidate(toInput(candidate));
    verifiedSummary.value = `${verified.source.owner}/${verified.source.repo}${verified.source.skillPath ? ` · ${verified.source.skillPath}` : ''}`;
    message.success('远程 SKILL.md 已验证');
  } catch (error) { selected.value = null; message.error(`验证失败: ${(error as Error).message}`); }
  finally { verifying.value = false; }
}

async function associate() {
  if (!selected.value) return;
  associating.value = true;
  try {
    const result = await api.associateSource(props.name, toInput(selected.value));
    message.success(result.warning);
    emit('associated');
  } catch (error) { message.error(`关联失败: ${(error as Error).message}`); }
  finally { associating.value = false; }
}

watch(() => props.name, () => { candidates.value = []; selected.value = null; verifiedSummary.value = ''; });
</script>

<template>
  <section class="panel">
    <div class="panel-head"><div><p class="meta-label">来源</p><h2>来源与更新资格</h2></div><n-button v-if="props.source.type === 'local'" size="small" :loading="loading" @click="discover"><template #icon><n-icon :component="SearchOutline" /></template>匹配来源</n-button></div>
    <div class="source-line"><n-icon :component="LinkOutline" size="17" /><code>{{ sourceLabel }}</code></div>
    <p v-if="props.source.type === 'local'" class="hint">仅搜索并验证候选；确认关联前不会下载或覆盖本地内容。</p>
    <div v-if="candidates.length" class="candidate-list">
      <article v-for="candidate in candidates" :key="`${candidate.source}:${candidate.skillId}`" class="candidate" :class="{ 'candidate--selected': selected?.skillId === candidate.skillId && verifiedSummary }">
        <div class="candidate-copy"><strong>{{ candidate.name }}</strong><code>{{ candidate.source }}/{{ candidate.skillId }}</code><p>{{ candidate.description || '未提供描述' }}</p><span>匹配：{{ candidate.matchedQueries.join(' · ') }}</span></div>
        <n-button size="small" :loading="verifying && selected?.skillId === candidate.skillId" @click="verify(candidate)">验证</n-button>
      </article>
    </div>
    <div v-if="verifiedSummary" class="verified"><div><p class="meta-label">已验证目标</p><code>{{ verifiedSummary }}</code></div><n-button type="primary" size="small" :loading="associating" @click="associate">确认关联</n-button></div>
  </section>
</template>

<style scoped>
.panel { display: grid; gap: var(--space-md); padding: var(--space-lg); border: var(--rule); border-radius: var(--radius-lg); background: var(--color-paper); }.panel-head, .verified, .candidate { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-md); }.panel h2 { margin: var(--space-2xs) 0 0; color: var(--color-ink); font-size: var(--text-lg); font-weight: 600; letter-spacing: -0.03em; }.source-line { display: flex; align-items: center; gap: var(--space-sm); min-inline-size: 0; padding: var(--space-sm); border: var(--rule); border-radius: var(--radius-sm); background: var(--color-paper-2); color: var(--color-accent); }.source-line code, .candidate code, .verified code { min-inline-size: 0; overflow-wrap: anywhere; font-family: var(--font-mono); font-size: var(--text-xs); }.hint, .candidate p { margin: 0; color: var(--color-muted); font-size: var(--text-sm); }.candidate-list { display: grid; gap: var(--space-xs); }.candidate { padding: var(--space-md); border: var(--rule); border-radius: var(--radius-sm); }.candidate--selected { border-color: var(--color-success); background: var(--color-success-soft); }.candidate-copy { display: grid; gap: var(--space-2xs); min-inline-size: 0; }.candidate-copy strong { color: var(--color-ink); }.candidate-copy span { color: var(--color-muted); font-family: var(--font-mono); font-size: 0.625rem; }.verified { padding: var(--space-md); border: 1px solid var(--color-success); border-radius: var(--radius-sm); background: var(--color-success-soft); } @media (max-width: 39.99rem) { .panel-head, .candidate, .verified { flex-direction: column; } }
</style>
