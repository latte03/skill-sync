<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LinkOutline, SearchOutline } from '@vicons/ionicons5';
import { useToast } from '../../composables/useToast';
import UiButton from '../ui/UiButton.vue';
import UiIcon from '../ui/UiIcon.vue';
import { api } from '../../api';
import type { SourceCandidate, SkillSource } from '../../api';

const props = defineProps<{ name: string; source: SkillSource }>();
const emit = defineEmits<{ associated: [] }>();
const message = useToast();
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
  <div class="source-panel">
    <div class="panel-head">
      <h2>来源</h2>
      <UiButton v-if="props.source.type === 'local'" variant="ghost" size="sm" :loading="loading" @click="discover">
        <template #icon><UiIcon :component="SearchOutline" size="13" /></template>
        匹配
      </UiButton>
    </div>
    <div class="source-line"><UiIcon :component="LinkOutline" size="14" /><code>{{ sourceLabel }}</code></div>
    <p v-if="props.source.type === 'local'" class="hint">仅搜索并验证候选；确认关联前不会下载或覆盖本地内容。</p>
    <div v-if="candidates.length" class="candidate-list">
      <article v-for="candidate in candidates" :key="`${candidate.source}:${candidate.skillId}`" class="candidate" :class="{ 'candidate--selected': selected?.skillId === candidate.skillId && verifiedSummary }">
        <div class="candidate-copy"><strong>{{ candidate.name }}</strong><code>{{ candidate.source }}/{{ candidate.skillId }}</code><p>{{ candidate.description || '未提供描述' }}</p></div>
        <UiButton size="sm" :loading="verifying && selected?.skillId === candidate.skillId" @click="verify(candidate)">验证</UiButton>
      </article>
    </div>
    <div v-if="verifiedSummary" class="verified">
      <code>{{ verifiedSummary }}</code>
      <UiButton variant="primary" size="sm" :loading="associating" @click="associate">确认关联</UiButton>
    </div>
  </div>
</template>

<style scoped>
.source-panel { display: grid; gap: .5rem; }
.panel-head { display: flex; align-items: center; justify-content: space-between; }
.panel-head h2 { margin: 0; color: var(--color-ink); font-size: var(--text-base); font-weight: 650; }
.source-line { display: flex; align-items: center; gap: .4rem; min-width: 0; color: var(--color-accent); }
.source-line code { min-width: 0; overflow-wrap: anywhere; font-family: var(--font-mono); font-size: var(--text-xs); }
.hint { margin: 0; color: var(--color-faint); font-size: var(--text-xs); line-height: 1.4; }
.candidate-list { display: grid; gap: .375rem; }
.candidate { display: flex; align-items: flex-start; justify-content: space-between; gap: .5rem; padding: .5rem; border: 1px solid var(--color-rule); border-radius: var(--radius-sm); }
.candidate--selected { border-color: var(--color-success); background: var(--color-success-soft); }
.candidate-copy { display: grid; gap: .1rem; min-width: 0; }
.candidate-copy strong { color: var(--color-ink); font-size: var(--text-xs); }
.candidate-copy code { overflow-wrap: anywhere; font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-muted); }
.candidate-copy p { margin: 0; color: var(--color-muted); font-size: var(--text-xs); }
.verified { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .5rem; border: 1px solid var(--color-success); border-radius: var(--radius-sm); background: var(--color-success-soft); }
.verified code { min-width: 0; overflow-wrap: anywhere; font-family: var(--font-mono); font-size: var(--text-xs); }
</style>
