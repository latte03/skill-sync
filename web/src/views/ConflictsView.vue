<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { RefreshOutline, WarningOutline } from '@vicons/ionicons5';
import { api } from '../api';
import type { ConflictInfo } from '../api';

const message = useMessage();
const conflicts = ref<ConflictInfo[]>([]);
const loading = ref(false);
const checked = ref(false);
const summary = computed(() => conflicts.value.length === 0 && checked.value ? '未发现冲突' : `${conflicts.value.length} 项待处理`);
function label(type: ConflictInfo['type']) { return { 'managed-mismatch': '管理状态不一致', unmanaged: '未管理副本', 'broken-symlink': '失效链接' }[type]; }
async function refresh() { loading.value = true; try { conflicts.value = (await api.getConflicts()).conflicts; checked.value = true; } catch (error) { message.error(`检测失败: ${(error as Error).message}`); } finally { loading.value = false; } }
async function redeploy(conflict: ConflictInfo) { try { await api.deploySkill(conflict.skillName, [conflict.agent], { force: true }); message.success('已强制重新分发'); await refresh(); } catch (error) { message.error(`修复失败: ${(error as Error).message}`); } }
async function remove(conflict: ConflictInfo) { try { await api.undeploySkill(conflict.skillName, [conflict.agent]); message.success('已移除该 Agent 中的副本'); await refresh(); } catch (error) { message.error(`移除失败: ${(error as Error).message}`); } }
</script>

<template>
  <div class="app-page conflicts-page"><header class="conflict-head"><div class="page-heading"><p class="page-kicker">DISTRIBUTION INTEGRITY</p><h1 class="page-title">一致性检查</h1><p class="page-summary">扫描中央仓库与 Agent 目录，找出需要人工确认或可直接收敛的分发差异。</p></div><n-button type="primary" size="small" :loading="loading" @click="refresh"><template #icon><n-icon :component="RefreshOutline" /></template>开始检查</n-button></header><section class="integrity-banner" :class="{ 'integrity-banner--clean': checked && conflicts.length === 0 }"><n-icon :component="WarningOutline" size="24" /><div><strong>{{ summary }}</strong><p>{{ checked ? conflicts.length ? '每个操作只会作用于对应 Skill 与 Agent。' : '中央仓库与已检测 Agent 的分发状态一致。' : '尚未开始扫描。' }}</p></div></section><n-spin :show="loading"><section v-if="conflicts.length" class="conflict-list"><article v-for="conflict in conflicts" :key="`${conflict.skillName}:${conflict.agent}:${conflict.destPath}`" class="conflict-card"><div><p class="meta-label">{{ label(conflict.type) }}</p><h2>{{ conflict.skillName }} <span>→ {{ conflict.agent }}</span></h2><p>{{ conflict.detail }}</p><code>{{ conflict.destPath }}</code></div><div class="inline-actions"><n-button size="small" @click="redeploy(conflict)">强制重新分发</n-button><n-button size="small" type="warning" @click="remove(conflict)">移除副本</n-button></div></article></section><n-empty v-else-if="checked" description="没有需要处理的分发冲突" /></n-spin></div>
</template>

<style scoped>
.conflict-head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-lg); }.integrity-banner { display: flex; align-items: flex-start; gap: var(--space-md); padding: var(--space-lg); border: 1px solid var(--color-warning); border-radius: var(--radius-lg); background: var(--color-warning-soft); color: var(--color-warning); }.integrity-banner--clean { border-color: var(--color-success); background: var(--color-success-soft); color: var(--color-success); }.integrity-banner strong { color: var(--color-ink); }.integrity-banner p { margin: var(--space-2xs) 0 0; color: var(--color-muted); font-size: var(--text-sm); }.conflict-list { display: grid; gap: var(--space-md); }.conflict-card { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-lg); padding: var(--space-lg); border: var(--rule); border-radius: var(--radius-lg); background: var(--color-paper); }.conflict-card h2 { margin: var(--space-xs) 0; color: var(--color-ink); font-size: var(--text-lg); letter-spacing: -0.03em; }.conflict-card h2 span { color: var(--color-muted); font-size: var(--text-sm); font-weight: 400; }.conflict-card p:not(.meta-label) { margin: 0; color: var(--color-muted); font-size: var(--text-sm); }.conflict-card code { display: block; margin-block-start: var(--space-sm); color: var(--color-accent); font-family: var(--font-mono); font-size: 0.625rem; overflow-wrap: anywhere; } @media (max-width: 39.99rem) { .conflict-head, .conflict-card { flex-direction: column; align-items: stretch; } }
</style>
