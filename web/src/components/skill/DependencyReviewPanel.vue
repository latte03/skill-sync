<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { CubeOutline, DownloadOutline, ShieldCheckmarkOutline } from '@vicons/ionicons5';
import { api } from '../../api';
import type { SkillDependencyReview } from '../../api';

const props = defineProps<{ name: string }>();
const message = useMessage();
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
  <section class="panel">
    <div class="panel-head"><div><p class="meta-label">依赖审查</p><h2>依赖审查</h2></div><n-button size="small" quaternary :loading="loading" @click="refresh">刷新</n-button></div>
    <template v-if="review">
      <div class="dependency-grid">
        <div class="dependency-block"><p class="block-title"><n-icon :component="CubeOutline" />Skill 依赖</p><n-empty v-if="review.skillDependencies.length === 0" size="small" description="未声明 Skill 依赖" /><ul v-else><li v-for="dependency in review.skillDependencies" :key="dependency.name"><code>{{ dependency.name }}</code><span :class="dependency.installed ? 'state-success' : 'state-danger'">{{ dependency.installed ? '已满足' : '缺失' }}</span></li></ul></div>
        <div class="dependency-block"><p class="block-title"><n-icon :component="ShieldCheckmarkOutline" />包依赖</p><template v-if="review.requiresExplicitInstall"><n-checkbox-group v-model:value="managers"><n-checkbox v-for="manager in declaredManagers" :key="manager" :value="manager">{{ manager }} · {{ review.packageDependencies[manager]?.join(', ') }}</n-checkbox></n-checkbox-group><n-button type="primary" size="small" :disabled="managers.length === 0" :loading="installing" @click="install"><template #icon><n-icon :component="DownloadOutline" /></template>显式安装所选依赖</n-button></template><n-empty v-else size="small" description="未声明包依赖" /></div>
      </div>
      <p class="safety-note">只会安装写入中央仓库 SKILL.md 的声明；客户端不提交包名，npm 生命周期脚本保持禁用。</p>
    </template>
  </section>
</template>

<style scoped>
.panel { display: grid; gap: var(--space-md); padding: var(--space-lg); border: var(--rule); border-radius: var(--radius-lg); background: var(--color-paper); }.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-md); }.panel h2 { margin: var(--space-2xs) 0 0; color: var(--color-ink); font-size: var(--text-lg); font-weight: 600; letter-spacing: -0.03em; }.dependency-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: var(--space-md); }.dependency-block { display: grid; align-content: start; gap: var(--space-sm); min-inline-size: 0; padding: var(--space-md); border: var(--rule); border-radius: var(--radius-sm); background: var(--color-paper-2); }.block-title { display: flex; align-items: center; gap: var(--space-xs); margin: 0; color: var(--color-ink); font-size: var(--text-sm); font-weight: 600; }.dependency-block ul { display: grid; gap: var(--space-xs); padding: 0; margin: 0; list-style: none; }.dependency-block li { display: flex; justify-content: space-between; gap: var(--space-sm); font-size: var(--text-xs); }.dependency-block code { overflow-wrap: anywhere; font-family: var(--font-mono); }.safety-note { margin: 0; color: var(--color-muted); font-size: var(--text-xs); } :deep(.n-checkbox-group) { display: grid; gap: var(--space-sm); } :deep(.n-button) { justify-self: start; }
</style>
