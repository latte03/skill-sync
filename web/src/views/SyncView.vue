<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { CloudDownloadOutline, CloudUploadOutline, LinkOutline, RefreshOutline, SettingsOutline } from '@vicons/ionicons5';
import { useToast } from '../composables/useToast';
import { api } from '../api';
import type { GitPlatformInfo, SyncCommit, SyncStatusInfo } from '../api';
import PageHeader from '../components/ui/PageHeader.vue';
import UiButton from '../components/ui/UiButton.vue';
import UiInput from '../components/ui/UiInput.vue';
import UiSpin from '../components/ui/UiSpin.vue';
import UiIcon from '../components/ui/UiIcon.vue';

const router = useRouter();
const message = useToast();
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
    <PageHeader eyebrow="远程同步" title="远程同步" summary="连接远程备份，并处理影响同步健康度的变更。"><template #actions><UiButton size="sm" :loading="loading" @click="refresh"><template #icon><UiIcon :component="RefreshOutline" /></template>刷新</UiButton></template></PageHeader>
    <UiSpin :show="loading"><div v-if="status" class="sync-content">
      <section v-if="needsSetup" class="setup-panel"><header><span class="setup-icon"><UiIcon :component="LinkOutline" size="18" /></span><div><p class="meta-label">首次配置</p><h2>建立远程同步</h2><p>完成三个一次性步骤，之后此页只显示同步健康度。</p></div></header><ol><li :class="{ done: status.isRepo }"><span>01</span><div><b>初始化中央仓库</b><small>{{ status.isRepo ? 'Git 仓库已就绪' : '在中央目录创建 Git 仓库' }}</small></div><UiButton v-if="!status.isRepo" variant="primary" size="sm" :loading="initializing" @click="initRepo">初始化</UiButton><em v-else>完成</em></li><li :class="{ done: activePlatform?.configured }"><span>02</span><div><b>确认平台凭证</b><small>{{ activePlatform?.configured ? `${activePlatform.name} 已连接` : '在设置中保存 Git Token' }}</small></div><UiButton v-if="!activePlatform?.configured" size="sm" @click="router.push({ name: 'settings' })"><template #icon><UiIcon :component="SettingsOutline" /></template>去设置</UiButton><em v-else>完成</em></li><li :class="{ done: status.hasRemote }"><span>03</span><div><b>连接远程仓库</b><small>{{ status.hasRemote ? '远程地址已保存' : '填写 HTTPS 或 SSH 地址' }}</small></div><div v-if="status.isRepo && !status.hasRemote" class="remote-form"><UiInput v-model="remoteUrl" placeholder="https://github.com/owner/repo.git" /><UiButton variant="primary" size="sm" :loading="savingRemote" @click="setRemote">连接</UiButton></div><em v-else-if="status.hasRemote">完成</em></li></ol></section>
      <template v-else>
        <section class="health-strip"><span class="health-dot" :class="health.type" /><div><p class="meta-label">同步健康度</p><b>{{ health.label }}</b><small>{{ health.detail }}</small></div><code>{{ status.branch ?? '无分支' }}</code></section>
        <section class="metric-strip"><article v-for="metric in [{ label: '待提交', value: status.uncommittedChanges, note: '待提交文件' }, { label: '本地领先', value: status.ahead, note: '尚未推送' }, { label: '远程领先', value: status.behind, note: '尚未拉取' }, { label: '远程目标', value: status.remotes.length, note: '已连接仓库' }]" :key="metric.label"><p>{{ metric.label }}</p><b>{{ metric.value }}</b><span>{{ metric.note }}</span></article></section>
        <section class="sync-actions"><div><p class="meta-label">同步操作</p><h2>处理本地变更</h2><span>推送前可补充说明；拉取继续使用服务端安全策略。</span></div><div class="action-form"><UiInput v-model="commitMessage" placeholder="提交说明（可留空）" /><UiButton variant="primary" :loading="pushing" @click="push"><template #icon><UiIcon :component="CloudUploadOutline" /></template>推送</UiButton><UiButton :loading="pulling" @click="pull"><template #icon><UiIcon :component="CloudDownloadOutline" /></template>拉取</UiButton></div></section>
        <section class="sync-details"><article><header><p class="meta-label">远程目标</p><span>{{ status.remotes.length }}</span></header><div v-for="remote in status.remotes" :key="remote.name" class="detail-row"><b>{{ remote.name }}</b><code>{{ remote.fetchUrl }}</code></div><div v-if="!status.remotes.length" class="detail-empty">未连接远程仓库</div></article><article><header><p class="meta-label">待提交文件</p><span>{{ status.changedFiles.length }}</span></header><div v-for="file in status.changedFiles.slice(0, 8)" :key="file.path" class="detail-row file-row"><b>{{ file.status }}</b><code>{{ file.path }}</code></div><div v-if="!status.changedFiles.length" class="detail-empty">工作区干净</div></article></section>
        <section class="commit-panel"><header><p class="meta-label">最近提交</p><span>{{ commits.length }}</span></header><ol v-if="commits.length"><li v-for="commit in commits" :key="commit.hash"><i /><div><b>{{ commit.message }}</b><small>{{ commit.author }} · {{ commit.hash.slice(0, 7) }} · {{ commit.date }}</small></div></li></ol><div v-else class="detail-empty">尚无提交记录</div></section>
      </template>
    </div></UiSpin>
  </div>
</template>

<style scoped>
.sync-head { display:flex;align-items:end;justify-content:space-between;gap:1rem; }.setup-panel,.health-strip,.metric-strip,.sync-actions,.sync-details>article,.commit-panel { border:1px solid var(--color-rule);border-radius:var(--radius-lg);background:var(--color-paper);box-shadow:var(--shadow-xs); }.setup-panel { overflow:hidden; }.setup-panel>header { display:flex;align-items:center;gap:.7rem;border-bottom:1px solid var(--color-rule);padding:.8rem; }.setup-icon { display:grid;width:2.1rem;height:2.1rem;place-items:center;border-radius:var(--radius-md);background:var(--color-accent-soft);color:var(--color-accent); }.setup-panel h2,.sync-actions h2 { margin:.12rem 0;color:var(--color-ink);font-size:.78rem;letter-spacing:-.025em; }.setup-panel header p:last-child { margin:0;color:var(--color-muted);font-size: .75rem; }.setup-panel ol { display:grid;gap:0;margin:0;padding:0;list-style:none; }.setup-panel li { display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.7rem;border-bottom:1px solid var(--color-rule);padding:.7rem .8rem; }.setup-panel li:last-child { border-bottom:0; }.setup-panel li>span { color:var(--color-faint);font-family:var(--font-mono);font-size: .75rem; }.setup-panel li b,.setup-panel li small { display:block; }.setup-panel li b { color:var(--color-ink-2);font-size: .75rem; }.setup-panel li small { margin-top:.1rem;color:var(--color-muted);font-size: .75rem; }.setup-panel li em { color:var(--color-success);font-family:var(--font-mono);font-size: .75rem;font-style:normal; }.remote-form { display:flex;min-width:min(27rem,45vw);gap:.35rem; }.health-strip { display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.7rem;padding:.75rem .85rem; }.health-dot { width:.52rem;height:.52rem;border-radius:999px;background:var(--color-accent);box-shadow:0 0 0 4px var(--color-accent-soft); }.health-dot.success { background:var(--color-success);box-shadow:0 0 0 4px var(--color-success-soft); }.health-dot.warning { background:var(--color-warning);box-shadow:0 0 0 4px var(--color-warning-soft); }.health-strip b,.health-strip small { display:block; }.health-strip b { margin-top:.08rem;color:var(--color-ink);font-size: .75rem; }.health-strip small { margin-top:.05rem;color:var(--color-muted);font-size: .75rem; }.health-strip code { border:1px solid var(--color-rule);border-radius:var(--radius-xs);background:var(--color-paper-2);padding:.2rem .38rem;color:var(--color-muted);font-family:var(--font-mono);font-size: .75rem; }.metric-strip { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden; }.metric-strip article { display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:.1rem .5rem;border-right:1px solid var(--color-rule);padding:.7rem .8rem; }.metric-strip article:last-child { border-right:0; }.metric-strip p { grid-column:1/-1;margin:0;color:var(--color-faint);font-family:var(--font-mono);font-size: .75rem;letter-spacing:.06em; }.metric-strip b { color:var(--color-ink);font-size:1rem;letter-spacing:-.04em; }.metric-strip span { color:var(--color-muted);font-size: .75rem; }.sync-actions { display:grid;grid-template-columns:minmax(0,.8fr) minmax(25rem,1.2fr);align-items:end;gap:1rem;padding:.8rem; }.sync-actions>div>span { color:var(--color-muted);font-size: .75rem; }.action-form { display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:.35rem; }.sync-details { display:grid;grid-template-columns:1fr 1fr;gap:.65rem; }.sync-details>article,.commit-panel { overflow:hidden; }.sync-details header,.commit-panel>header { display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--color-rule);padding:.62rem .72rem; }.sync-details header span,.commit-panel header span { color:var(--color-faint);font-family:var(--font-mono);font-size: .75rem; }.detail-row { display:grid;grid-template-columns:auto minmax(0,1fr);gap:.55rem;border-bottom:1px solid var(--color-rule);padding:.52rem .7rem; }.detail-row:last-child { border-bottom:0; }.detail-row b { color:var(--color-ink-2);font-size: .75rem; }.detail-row code { overflow:hidden;color:var(--color-muted);font-family:var(--font-mono);font-size: .75rem;text-overflow:ellipsis;white-space:nowrap; }.file-row b { color:var(--color-accent);font-family:var(--font-mono); }.detail-empty { padding:1rem;color:var(--color-muted);font-size: .75rem;text-align:center; }.commit-panel ol { display:grid;margin:0;padding:0;list-style:none; }.commit-panel li { display:grid;grid-template-columns:auto minmax(0,1fr);gap:.55rem;border-bottom:1px solid var(--color-rule);padding:.55rem .72rem; }.commit-panel li:last-child { border-bottom:0; }.commit-panel li i { width:.38rem;height:.38rem;margin-top:.2rem;border-radius:999px;background:var(--color-accent); }.commit-panel li b,.commit-panel li small { display:block; }.commit-panel li b { color:var(--color-ink-2);font-size: .75rem; }.commit-panel li small { margin-top:.1rem;color:var(--color-muted);font-family:var(--font-mono);font-size: .75rem; } @media(max-width:52rem){.sync-actions{grid-template-columns:1fr}.metric-strip{grid-template-columns:1fr 1fr}.metric-strip article:nth-child(2){border-right:0}.metric-strip article:nth-child(-n+2){border-bottom:1px solid var(--color-rule)}.sync-details{grid-template-columns:1fr}} @media(max-width:40rem){.remote-form,.action-form{min-width:0;grid-template-columns:1fr}.remote-form{display:grid}.setup-panel li{grid-template-columns:auto minmax(0,1fr)}.setup-panel li>:last-child{grid-column:2}.metric-strip{grid-template-columns:1fr}.metric-strip article{border-right:0;border-bottom:1px solid var(--color-rule)}.metric-strip article:last-child{border-bottom:0}}
.sync-content { display:grid;gap:1.25rem; }.setup-panel>header { gap: 1rem; padding: 1.1rem; }.setup-icon { width: 2.5rem; height: 2.5rem; }.setup-panel h2,.sync-actions h2 { font-size: 1rem; }.setup-panel header p:last-child { font-size: .75rem; }.setup-panel li { gap: 1rem; padding: .9rem 1.1rem; }.setup-panel li>span { font-size: .75rem; }.setup-panel li b { font-size: .78rem; }.setup-panel li small,.setup-panel li em { font-size: .75rem; }
.health-strip { gap: 1rem; padding: 1rem 1.1rem; }.health-strip b { font-size: .9rem; }.health-strip small,.health-strip code { font-size: .75rem; }.metric-strip article { gap: .25rem .7rem; padding: 1rem 1.1rem; }.metric-strip p { font-size: .75rem; }.metric-strip b { font-size: 1.3rem; }.metric-strip span { font-size: .75rem; }
.sync-actions { gap: 1.5rem; padding: 1.1rem; }.sync-actions>div>span { font-size: .75rem; }.sync-details { gap: 1.25rem; }.sync-details header,.commit-panel>header { padding: .85rem 1rem; }.sync-details header span,.commit-panel header span { font-size: .75rem; }.detail-row { gap: .75rem; padding: .72rem 1rem; }.detail-row b { font-size: .75rem; }.detail-row code { font-size: .75rem; }.commit-panel li { gap: .75rem; padding: .75rem 1rem; }.commit-panel li b { font-size: .75rem; }.commit-panel li small { font-size: .75rem; }
</style>
