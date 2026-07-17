<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { CloudDownloadOutline, CloudUploadOutline, LinkOutline, RefreshOutline, SettingsOutline } from '@vicons/ionicons5';
import { api } from '../api';
import type { GitPlatformInfo, SyncCommit, SyncStatusInfo } from '../api';

const router = useRouter();
const message = useMessage();
const status = ref<SyncStatusInfo | null>(null);
const commits = ref<SyncCommit[]>([]);
const platforms = ref<GitPlatformInfo[]>([]);
const loading = ref(false);
const initializing = ref(false);
const savingRemote = ref(false);
const pushing = ref(false);
const pulling = ref(false);
const remoteUrl = shallowRef('');
const commitMessage = shallowRef('');

const activePlatform = computed(() => platforms.value.find(platform => platform.enabled));
const needsSetup = computed(() => !status.value?.isRepo || !status.value.hasRemote);
const health = computed(() => {
  if (!status.value?.isRepo) return { label: '未初始化', type: 'warning' as const, detail: '中央仓库尚未是 Git 仓库' };
  if (!status.value.hasRemote) return { label: '待连接', type: 'warning' as const, detail: '需要配置远程仓库地址' };
  if (status.value.behind > 0) return { label: '需要拉取', type: 'warning' as const, detail: `远程领先 ${status.value.behind} 个提交` };
  if (status.value.ahead > 0 || status.value.uncommittedChanges > 0) return { label: '待推送', type: 'info' as const, detail: '本地存在可同步的变更' };
  return { label: '已同步', type: 'success' as const, detail: '本地与远程状态一致' };
});

async function refresh() {
  loading.value = true;
  try {
    const [syncResponse, logResponse, platformResponse] = await Promise.all([api.getSyncStatus(), api.getSyncLog(12), api.getGitPlatforms()]);
    status.value = syncResponse;
    commits.value = logResponse.commits;
    platforms.value = platformResponse.platforms;
  } catch (error) {
    message.error(`加载同步状态失败: ${(error as Error).message}`);
  } finally {
    loading.value = false;
  }
}

async function initRepo() {
  initializing.value = true;
  try { await api.initGit(); message.success('Git 仓库已初始化'); await refresh(); }
  catch (error) { message.error(`初始化失败: ${(error as Error).message}`); }
  finally { initializing.value = false; }
}

async function setRemote() {
  if (!remoteUrl.value.trim()) return;
  savingRemote.value = true;
  try { await api.setRemote(remoteUrl.value.trim()); remoteUrl.value = ''; message.success('远程仓库已连接'); await refresh(); }
  catch (error) { message.error(`连接远程失败: ${(error as Error).message}`); }
  finally { savingRemote.value = false; }
}

async function push() {
  pushing.value = true;
  try { const result = await api.pushSync(commitMessage.value.trim() || undefined); if (!result.success) throw new Error(result.error); commitMessage.value = ''; message.success(result.pushed ? `已推送 ${result.pushed} 个变更` : '没有需要推送的变更'); await refresh(); }
  catch (error) { message.error(`推送失败: ${(error as Error).message}`); }
  finally { pushing.value = false; }
}

async function pull() {
  pulling.value = true;
  try { const result = await api.pullSync(); if (!result.success) throw new Error(result.error ?? result.conflicts.join('、')); message.success(result.pulled ? `已拉取 ${result.pulled} 个变更` : '没有远程变更'); await refresh(); }
  catch (error) { message.error(`拉取失败: ${(error as Error).message}`); }
  finally { pulling.value = false; }
}

refresh();
</script>

<template>
  <div class="app-page sync-page">
    <header class="grid gap-6 lg:grid-cols-[minmax(0_1fr)_auto] lg:items-end"><div class="page-heading"><p class="page-kicker">GIT SYNCHRONIZATION</p><h1 class="page-title">同步状态</h1><p class="page-summary">首次连接完成后，这里只保留影响同步决策的状态与操作。</p></div><div class="page-toolbar lg:justify-end"><n-button size="small" :loading="loading" @click="refresh"><template #icon><n-icon :component="RefreshOutline" /></template>刷新</n-button></div></header>

    <n-spin :show="loading">
      <template v-if="status">
        <section v-if="needsSetup" class="grid gap-8 rounded-[var(--radius-lg)] bg-[var(--color-graphite)] p-6 text-[var(--color-graphite-ink)] shadow-[var(--shadow-md)] sm:p-8">
          <div class="max-w-[58ch]"><p class="m-0 text-[0.6875rem] font-[var(--font-mono)] tracking-[0.12em] uppercase text-[var(--color-accent)]">FIRST-TIME SETUP</p><h2 class="my-3 font-[var(--font-display)] text-3xl leading-none tracking-[-0.06em]">建立远程同步</h2><p class="m-0 text-sm leading-6 text-[var(--color-graphite-ink)]/70">依次初始化中央仓库、确认 Git 平台凭证、再连接远程仓库。完成后页面将切换为日常同步视图。</p></div>
          <ol class="grid list-none gap-2 p-0 m-0">
            <li :class="['grid gap-3 rounded-[var(--radius-md)] border p-4 sm:grid-cols-[auto_minmax(0_1fr)_auto] sm:items-center', status.isRepo ? 'border-[var(--color-success)]/45 bg-[var(--color-success)]/12' : 'border-white/10 bg-white/5']"><span class="font-[var(--font-mono)] text-xs text-[var(--color-muted)]">01</span><div><strong class="text-sm">初始化中央仓库</strong><p class="m-0 text-xs text-[var(--color-graphite-ink)]/64">{{ status.isRepo ? 'Git 仓库已就绪' : '在本地创建 Git 仓库' }}</p></div><n-button v-if="!status.isRepo" size="small" type="primary" :loading="initializing" @click="initRepo">初始化</n-button></li>
            <li :class="['grid gap-3 rounded-[var(--radius-md)] border p-4 sm:grid-cols-[auto_minmax(0_1fr)_auto] sm:items-center', activePlatform?.configured ? 'border-[var(--color-success)]/45 bg-[var(--color-success)]/12' : 'border-white/10 bg-white/5']"><span class="font-[var(--font-mono)] text-xs text-[var(--color-muted)]">02</span><div><strong class="text-sm">确认平台凭证</strong><p class="m-0 text-xs text-[var(--color-graphite-ink)]/64">{{ activePlatform?.configured ? `${activePlatform.name} 已连接` : '先在连接设置中保存 Git Token' }}</p></div><n-button v-if="!activePlatform?.configured" size="small" @click="router.push({ name: 'settings' })"><template #icon><n-icon :component="SettingsOutline" /></template>去设置</n-button></li>
            <li :class="['grid gap-3 rounded-[var(--radius-md)] border p-4 sm:grid-cols-[auto_minmax(0_1fr)_auto] sm:items-center', status.hasRemote ? 'border-[var(--color-success)]/45 bg-[var(--color-success)]/12' : 'border-white/10 bg-white/5']"><span class="font-[var(--font-mono)] text-xs text-[var(--color-muted)]">03</span><div><strong class="text-sm">连接远程仓库</strong><p class="m-0 text-xs text-[var(--color-graphite-ink)]/64">{{ status.hasRemote ? '远程地址已保存' : '填写 HTTPS 或 SSH 远程地址' }}</p></div><div v-if="status.isRepo && !status.hasRemote" class="grid gap-2 sm:flex"><n-input v-model:value="remoteUrl" placeholder="https://github.com/owner/skill-sync.git" /><n-button type="primary" size="small" :loading="savingRemote" @click="setRemote"><template #icon><n-icon :component="LinkOutline" /></template>连接</n-button></div></li>
          </ol>
        </section>

        <template v-else>
          <section class="grid gap-6 rounded-[var(--radius-lg)] bg-[var(--color-graphite)] p-6 text-[var(--color-graphite-ink)] shadow-[var(--shadow-md)] sm:flex sm:items-start sm:justify-between sm:p-8"><div><p class="m-0 text-[0.6875rem] font-[var(--font-mono)] tracking-[0.12em] uppercase text-[var(--color-accent)]">SYNC HEALTH</p><strong class="mt-3 block font-[var(--font-display)] text-[clamp(2.25rem_5vw_4rem)] leading-none tracking-[-0.07em]">{{ health.label }}</strong><p class="mt-3 mb-0 text-sm text-[var(--color-graphite-ink)]/68">{{ health.detail }}</p></div><n-tag :type="health.type" size="large">{{ status.branch ?? '无分支' }}</n-tag></section>

          <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><article v-for="metric in [{ label: 'UNCOMMITTED', value: status.uncommittedChanges, note: '待提交文件' }, { label: 'AHEAD', value: status.ahead, note: '本地领先提交' }, { label: 'BEHIND', value: status.behind, note: '远程领先提交' }, { label: 'REMOTE', value: status.remotes.length, note: '已连接远程' }]" :key="metric.label" class="surface grid gap-2 p-5"><p class="metric-label">{{ metric.label }}</p><strong class="font-[var(--font-display)] text-3xl leading-none tracking-[-0.06em] text-[var(--color-ink)]">{{ metric.value }}</strong><span class="text-xs text-[var(--color-muted)]">{{ metric.note }}</span></article></section>

          <section class="surface grid gap-6 p-6 lg:grid-cols-[minmax(0_1fr)_minmax(22rem_0.9fr)] lg:items-end"><div><p class="meta-label">SYNC ACTIONS</p><h2 class="my-2 font-[var(--font-display)] text-2xl leading-none tracking-[-0.05em] text-[var(--color-ink)]">处理变更</h2><p class="m-0 text-sm leading-6 text-[var(--color-muted)]">推送前可写入说明；拉取会沿用服务端的安全同步策略。</p></div><div class="grid gap-2 sm:grid-cols-[minmax(0_1fr)_auto_auto] sm:items-center"><n-input v-model:value="commitMessage" placeholder="提交说明（可留空）" /><n-button type="primary" :loading="pushing" @click="push"><template #icon><n-icon :component="CloudUploadOutline" /></template>推送</n-button><n-button :loading="pulling" @click="pull"><template #icon><n-icon :component="CloudDownloadOutline" /></template>拉取</n-button></div></section>

          <section class="grid gap-4 lg:grid-cols-2"><article class="surface grid content-start gap-3 p-6"><p class="meta-label">REMOTE TARGETS</p><div v-for="remote in status.remotes" :key="remote.name" class="grid gap-1 border-b border-[var(--color-rule)] py-3 last:border-b-0"><strong class="text-xs text-[var(--color-ink)]">{{ remote.name }}</strong><code class="break-words font-[var(--font-mono)] text-[0.6875rem] text-[var(--color-muted)]">{{ remote.fetchUrl }}</code></div><n-empty v-if="status.remotes.length === 0" size="small" description="未连接远程仓库" /></article><article class="surface grid content-start gap-3 p-6"><p class="meta-label">PENDING FILES</p><div v-for="file in status.changedFiles.slice(0, 8)" :key="file.path" class="grid gap-1 border-b border-[var(--color-rule)] py-3 last:border-b-0"><span class="text-xs font-600 text-[var(--color-ink)]">{{ file.status }}</span><code class="break-words font-[var(--font-mono)] text-[0.6875rem] text-[var(--color-muted)]">{{ file.path }}</code></div><n-empty v-if="status.changedFiles.length === 0" size="small" description="工作区干净" /></article></section>

          <section class="surface grid gap-6 p-6"><div><p class="meta-label">RECENT COMMITS</p><h2 class="mt-2 mb-0 font-[var(--font-display)] text-2xl leading-none tracking-[-0.05em] text-[var(--color-ink)]">最近提交</h2></div><ol v-if="commits.length" class="grid list-none gap-4 p-0 m-0"><li v-for="commit in commits" :key="commit.hash" class="grid grid-cols-[auto_minmax(0_1fr)] gap-3"><span class="mt-1.5 h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_0_4px_var(--color-accent-soft)]"></span><div><strong class="text-sm text-[var(--color-ink)]">{{ commit.message }}</strong><p class="mt-1 mb-0 break-words font-[var(--font-mono)] text-[0.6875rem] text-[var(--color-muted)]">{{ commit.author }} · {{ commit.hash.slice(0, 7) }} · {{ commit.date }}</p></div></li></ol><n-empty v-else description="尚无提交记录" /></section>
        </template>
      </template>
    </n-spin>
  </div>
</template>
