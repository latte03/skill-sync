<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CubeOutline, DownloadOutline, ShieldCheckmarkOutline } from '@vicons/ionicons5';
import { useToast } from '../../composables/useToast';
import UiButton from '../ui/UiButton.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';
import UiCheckboxGroup from '../ui/UiCheckboxGroup.vue';
import UiIcon from '../ui/UiIcon.vue';
import { api } from '../../api';
import type { SkillDependencyReview } from '../../api';

const props = defineProps<{ name: string }>();
const message = useToast();
const review = ref<SkillDependencyReview | null>(null);
const loading = ref(false);
const installing = ref(false);
const managers = ref<Array<'npm' | 'pip'>>([]);
const declaredManagers = computed(() => (['npm', 'pip'] as const).filter(manager => (review.value?.packageDependencies[manager]?.length ?? 0) > 0));

async function refresh() {
  loading.value = true;
  try { review.value = (await api.getDependencyReview(props.name)).review; managers.value = [...declaredManagers.value]; }
  catch (error) { message.error(`读取依赖审查失败: ${(error as Error).message}`); }
  finally { loading.value = false; }
}

async function install() {
  installing.value = true;
  try { const result = await api.installReviewedDependencies(props.name, managers.value); message.success(`已显式安装：${result.installedManagers.join(', ')}`); await refresh(); }
  catch (error) { message.error(`安装依赖失败: ${(error as Error).message}`); }
  finally { installing.value = false; }
}

watch(() => props.name, refresh, { immediate: true });
</script>

<template>
  <div class="dep-panel">
    <div class="panel-head">
      <h2>依赖</h2>
      <UiButton variant="ghost" size="sm" :loading="loading" @click="refresh">刷新</UiButton>
    </div>
    <template v-if="review">
      <div class="dependency-grid">
        <div class="dependency-block">
          <p class="block-title"><UiIcon :component="CubeOutline" size="13" />Skill 依赖</p>
          <p v-if="review.skillDependencies.length === 0" class="empty-hint">未声明</p>
          <ul v-else>
            <li v-for="dependency in review.skillDependencies" :key="dependency.name">
              <code>{{ dependency.name }}</code>
              <span :class="dependency.installed ? 'state-ok' : 'state-miss'">{{ dependency.installed ? '已满足' : '缺失' }}</span>
            </li>
          </ul>
        </div>
        <div class="dependency-block">
          <p class="block-title"><UiIcon :component="ShieldCheckmarkOutline" size="13" />包依赖</p>
          <template v-if="review.requiresExplicitInstall">
            <UiCheckboxGroup v-model="managers">
              <UiCheckbox v-for="manager in declaredManagers" :key="manager" :value="manager">{{ manager }} · {{ review.packageDependencies[manager]?.join(', ') }}</UiCheckbox>
            </UiCheckboxGroup>
            <UiButton variant="primary" size="sm" :disabled="managers.length === 0" :loading="installing" @click="install">
              <template #icon><UiIcon :component="DownloadOutline" size="13" /></template>
              安装所选
            </UiButton>
          </template>
          <p v-else class="empty-hint">未声明</p>
        </div>
      </div>
      <p class="safety-note">只安装 SKILL.md 声明的依赖；npm 生命周期脚本保持禁用。</p>
    </template>
  </div>
</template>

<style scoped>
.dep-panel { display: grid; gap: .5rem; }
.panel-head { display: flex; align-items: center; justify-content: space-between; }
.panel-head h2 { margin: 0; color: var(--color-ink); font-size: var(--text-base); font-weight: 650; }
.dependency-grid { display: grid; gap: .5rem; }
.dependency-block { display: grid; align-content: start; gap: .35rem; min-width: 0; }
.block-title { display: flex; align-items: center; gap: .35rem; margin: 0; color: var(--color-ink-2); font-size: var(--text-xs); font-weight: 600; }
.dependency-block ul { display: grid; gap: .2rem; padding: 0; margin: 0; list-style: none; }
.dependency-block li { display: flex; justify-content: space-between; gap: .5rem; font-size: var(--text-xs); }
.dependency-block code { overflow-wrap: anywhere; font-family: var(--font-mono); color: var(--color-ink-2); }
.state-ok { color: var(--color-success); font-weight: 550; }
.state-miss { color: var(--color-danger); font-weight: 550; }
.empty-hint { margin: 0; color: var(--color-faint); font-size: var(--text-xs); }
.safety-note { margin: 0; color: var(--color-faint); font-size: var(--text-xs); line-height: 1.4; }
:deep(.n-checkbox-group) { display: grid; gap: .35rem; }
:deep(.n-checkbox) { font-size: var(--text-xs); }
</style>
