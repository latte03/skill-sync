<template>
  <div class="sync-page">
    <!-- ─── Page Header ─── -->
    <div class="page-title-row">
      <h1 class="page-title">Git 同步</h1>
      <n-button size="small" quaternary @click="refreshAll" :loading="loading">
        刷新
      </n-button>
    </div>

    <n-spin :show="loading">
      <!-- ─── Git 平台选择 ─── -->
      <div v-if="!loading" class="section-card">
        <div class="section-header">
          <n-icon size="18" class="section-icon"><GitNetworkOutline /></n-icon>
          <span class="section-title">Git 平台</span>
        </div>
        <div class="platform-selector">
          <div
            v-for="p in gitPlatforms"
            :key="p.id"
            class="platform-option"
            :class="{ active: activePlatform === p.id, bound: p.configured }"
            @click="selectPlatform(p.id)"
          >
            <BrandIcon :providerId="p.id" :providerName="p.name" :size="28" />
            <div class="platform-option-info">
              <span class="platform-option-name">{{ p.name }}</span>
              <span v-if="p.configured && p.username" class="platform-option-user">{{ p.username }}</span>
              <span v-else-if="!p.configured" class="platform-option-unbound">未绑定</span>
            </div>
            <n-icon v-if="activePlatform === p.id" size="18" class="platform-check"><CheckmarkCircle /></n-icon>
          </div>
        </div>
        <div v-if="!currentPlatform?.configured" class="platform-unbound-hint">
<n-icon size="14" class="hint-icon"><AlertCircleOutline /></n-icon>
            <span>当前平台未绑定身份凭证，请先前往<a @click="goToSettings">设置</a>绑定</span>
        </div>
      </div>

      <!-- ─── Not Initialized ─── -->
      <div v-if="!loading && status && !status.isRepo" class="empty-card">
        <n-icon size="48">
          <GitBranchOutline />
        </n-icon>
        <p class="empty-title">Git 仓库未初始化</p>
        <p class="empty-desc">初始化 Git 仓库后即可同步 skill 到远程</p>
        <n-button type="primary" size="small" @click="doInit" :loading="initLoading">
          初始化 Git 仓库
        </n-button>
      </div>

      <!-- ─── Repo Info ─── -->
      <template v-else-if="status">
        <!-- Status Cards -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ status.branch ?? '—' }}</div>
            <div class="stat-label">当前分支</div>
          </div>

          <div class="stat-card" :class="{ 'stat-warn': status.ahead > 0 }">
            <div class="stat-value">{{ status.ahead }}</div>
            <div class="stat-label">领先远程</div>
          </div>

          <div class="stat-card" :class="{ 'stat-warn': status.behind > 0 }">
            <div class="stat-value">{{ status.behind }}</div>
            <div class="stat-label">落后远程</div>
          </div>

          <div class="stat-card" :class="{ 'stat-warn': status.uncommittedChanges > 0 }">
            <div class="stat-value">{{ status.uncommittedChanges }}</div>
            <div class="stat-label">未提交变更</div>
          </div>
        </div>

        <!-- ─── Sync Actions ─── -->
        <div class="section-card">
          <div class="section-header">
            <n-icon size="18" class="section-icon"><CloudUploadOutline /></n-icon>
            <span class="section-title">同步操作</span>
          </div>

          <div class="sync-actions">
            <div class="action-row">
              <n-input
                v-model:value="commitMessage"
                placeholder="提交信息（留空将自动生成）"
                size="small"
                style="flex: 1"
              />
              <n-button
                size="small"
                quaternary
                @click="generateCommit"
                :loading="generatingCommit"
              >
                <template #icon>
                  <n-icon><SparklesOutline /></n-icon>
                </template>
                AI 生成
              </n-button>
              <n-button
                type="primary"
                size="small"
                :loading="pushLoading"
                :disabled="!status.hasRemote"
                @click="doPush"
              >
                <template #icon>
                  <n-icon><CloudUploadOutline /></n-icon>
                </template>
                推送
              </n-button>
              <n-button
                size="small"
                :loading="pullLoading"
                :disabled="!status.hasRemote"
                @click="doPull"
              >
                <template #icon>
                  <n-icon><CloudDownloadOutline /></n-icon>
                </template>
                拉取
              </n-button>
            </div>

            <div v-if="!status.hasRemote" class="no-remote-hint">
              <n-icon size="14" class="hint-icon"><AlertCircleOutline /></n-icon>
              <span>尚未配置远程仓库，请在下方设置远程仓库地址</span>
            </div>
          </div>
        </div>

        <!-- ─── Remote Config ─── -->
        <div class="section-card">
          <div class="section-header">
            <n-icon size="18" class="section-icon"><GitNetworkOutline /></n-icon>
            <span class="section-title">远程仓库</span>
          </div>

          <div v-if="status.remotes.length > 0" class="remote-list">
            <div v-for="remote in status.remotes" :key="remote.name" class="remote-item">
              <span class="remote-name">{{ remote.name }}</span>
              <code class="remote-url">{{ remote.fetchUrl }}</code>
            </div>
          </div>

          <div class="remote-set-row">
            <n-input
              v-model:value="remoteUrl"
              placeholder="https://github.com/user/skill-repo.git"
              size="small"
              style="flex: 1"
            />
            <n-button size="small" @click="doSetRemote" :loading="remoteLoading">
              设置
            </n-button>
          </div>
        </div>

        <!-- ─── Changed Files ─── -->
        <div v-if="status.changedFiles.length > 0" class="section-card">
          <div class="section-header">
            <n-icon size="18" class="section-icon"><DocumentTextOutline /></n-icon>
            <span class="section-title">未提交变更 ({{ status.changedFiles.length }})</span>
          </div>
          <div class="file-list">
            <div v-for="file in status.changedFiles" :key="file.path" class="file-item">
              <span
                class="file-status-badge"
                :class="`status-${file.status}`"
              >
                {{ fileStatusLabel(file.status) }}
              </span>
              <code class="file-path">{{ file.path }}</code>
            </div>
          </div>
        </div>

        <!-- ─── Commit History ─── -->
        <div class="section-card">
          <div class="section-header">
            <n-icon size="18" class="section-icon"><TimeOutline /></n-icon>
            <span class="section-title">提交历史</span>
          </div>

          <div v-if="commits.length > 0" class="commit-timeline">
            <div v-for="commit in commits" :key="commit.hash" class="commit-item">
              <div class="commit-dot" :class="{ 'commit-head': commit.refs.includes('HEAD') }"></div>
              <div class="commit-body">
                <div class="commit-message">{{ commit.message }}</div>
                <div class="commit-meta">
                  <span class="commit-author">{{ commit.author }}</span>
                  <span class="commit-hash">{{ commit.hash.substring(0, 7) }}</span>
                  <span class="commit-date">{{ formatDate(commit.date) }}</span>
                  <span v-if="commit.refs" class="commit-refs">{{ commit.refs }}</span>
                </div>
              </div>
            </div>
          </div>

          <n-empty v-else description="暂无提交记录" class="empty-inline" />
        </div>
      </template>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import {
    GitBranchOutline,
    GitNetworkOutline,
    CloudUploadOutline,
    CloudDownloadOutline,
    DocumentTextOutline,
    TimeOutline,
    AlertCircleOutline,
    SparklesOutline,
    CheckmarkCircle,
  } from '@vicons/ionicons5';
import BrandIcon from '../components/brand-icon.vue';
import { api, type SyncStatusInfo, type SyncCommit, type GitPlatformInfo } from '../api';

const message = useMessage();
const router = useRouter();

const loading = ref(false);
const status = ref<SyncStatusInfo | null>(null);
const commits = ref<SyncCommit[]>([]);
const commitMessage = ref('');
const remoteUrl = ref('');

// Git 平台
const gitPlatforms = ref<GitPlatformInfo[]>([]);
const activePlatform = ref<'github' | 'gitee'>('github');

const pushLoading = ref(false);
const pullLoading = ref(false);
const initLoading = ref(false);
const remoteLoading = ref(false);
const generatingCommit = ref(false);

const currentPlatform = computed(() =>
  gitPlatforms.value.find(p => p.id === activePlatform.value)
);

async function refreshAll() {
  loading.value = true;
  try {
    const [statusRes, logRes, platformsRes] = await Promise.all([
      api.getSyncStatus(),
      api.getSyncLog(30),
      api.getGitPlatforms(),
    ]);
    status.value = statusRes;
    commits.value = logRes.commits;
    gitPlatforms.value = platformsRes.platforms;
    if (platformsRes.active) {
      activePlatform.value = platformsRes.active;
    }
  } catch (e) {
    message.error(`加载失败: ${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
}

async function selectPlatform(platform: 'github' | 'gitee') {
  try {
    await api.enableGitPlatform(platform, true);
    activePlatform.value = platform;
    message.success(`已切换到 ${platform === 'github' ? 'GitHub' : 'Gitee'}`);
    await refreshAll();
  } catch (e) {
    message.error(`切换失败: ${(e as Error).message}`);
  }
}

function goToSettings() {
  router.push({ name: 'settings' });
}

async function doPush() {
  pushLoading.value = true;
  try {
    const result = await api.pushSync(commitMessage.value || undefined);
    if (result.success) {
      if (result.pushed > 0) {
        message.success(`已推送 ${result.pushed} 个变更`);
      } else {
        message.info('无变更可推送');
      }
      commitMessage.value = '';
      await refreshAll();
    } else {
      message.error(`推送失败: ${result.error}`);
    }
  } catch (e) {
    message.error(`推送失败: ${(e as Error).message}`);
  } finally {
    pushLoading.value = false;
  }
}

async function doPull() {
  pullLoading.value = true;
  try {
    const result = await api.pullSync();
    if (result.success) {
      if (result.pulled > 0) {
        message.success(`已拉取 ${result.pulled} 个变更`);
      } else {
        message.info('无远程变更');
      }
      await refreshAll();
    } else if (result.conflicts.length > 0) {
      message.warning(`合并冲突 (${result.conflicts.length} 个文件): ${result.conflicts.join(', ')}`);
    } else {
      message.error(`拉取失败: ${result.error}`);
    }
  } catch (e) {
    message.error(`拉取失败: ${(e as Error).message}`);
  } finally {
    pullLoading.value = false;
  }
}

async function doInit() {
  initLoading.value = true;
  try {
    await api.initGit();
    message.success('Git 仓库已初始化');
    await refreshAll();
  } catch (e) {
    message.error(`初始化失败: ${(e as Error).message}`);
  } finally {
    initLoading.value = false;
  }
}

async function doSetRemote() {
  if (!remoteUrl.value.trim()) {
    message.warning('请输入远程仓库地址');
    return;
  }
  remoteLoading.value = true;
  try {
    await api.setRemote(remoteUrl.value.trim());
    message.success('远程仓库已设置');
    remoteUrl.value = '';
    await refreshAll();
  } catch (e) {
    message.error(`设置失败: ${(e as Error).message}`);
  } finally {
    remoteLoading.value = false;
  }
}

function fileStatusLabel(status: string): string {
  switch (status) {
    case 'untracked': return '新';
    case 'modified': return '改';
    case 'deleted': return '删';
    case 'staged': return '暂';
    default: return status;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

onMounted(() => {
  refreshAll();
});

async function generateCommit() {
  generatingCommit.value = true;
  try {
    const result = await api.generateCommitMessage();
    commitMessage.value = result.message;
    message.success(`AI 已生成 commit 消息（${result.fileCount} 个文件变更）`);
  } catch (e) {
    message.error(`生成失败: ${(e as Error).message}`);
  } finally {
    generatingCommit.value = false;
  }
}
</script>

<style scoped>
.sync-page {
  max-width: 860px;
  margin: 0 auto;
}

/* ─── Empty / Not Initialized ───────────────────────────────────── */
.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 20px;
  text-align: center;
}

.empty-card .n-icon {
  color: var(--text-3);
}

.empty-title {
  margin: 8px 0 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.empty-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-2);
}

/* ─── Stats Grid ─────────────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 18px;
}

.stat-card {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.stat-card.stat-warn {
  border-color: color-mix(in srgb, var(--warning) 35%, var(--border));
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.015em;
}

.stat-card.stat-warn .stat-value {
  color: var(--warning);
}

.stat-label {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 500;
  margin-top: 2px;
}

/* ─── Section Card ───────────────────────────────────────────────── */
.section-card {
  padding: 16px 18px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  margin-bottom: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.section-icon {
  color: var(--text-2);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

/* ─── Sync Actions ───────────────────────────────────────────────── */
.sync-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.no-remote-hint,
.platform-unbound-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--warning);
}

.platform-unbound-hint {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--warning) 8%, transparent);
}

.platform-unbound-hint a {
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
}

.hint-icon {
  color: var(--warning);
}

/* ─── Remote Config ──────────────────────────────────────────────── */
.remote-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.remote-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.remote-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  min-width: 60px;
}

.remote-url {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: var(--accent);
  word-break: break-all;
}

.remote-set-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ─── Changed Files ──────────────────────────────────────────────── */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}

.file-status-badge {
  font-size: 10px;
  font-weight: 700;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-untracked {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: color-mix(in srgb, var(--success) 80%, #000);
}

.status-modified {
  background: color-mix(in srgb, var(--warning) 14%, transparent);
  color: color-mix(in srgb, var(--warning) 75%, #000);
}

.status-deleted {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: color-mix(in srgb, var(--danger) 78%, #000);
}

.status-staged {
  background: var(--accent-soft);
  color: var(--accent);
}

.file-path {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: var(--text-2);
  word-break: break-all;
}

/* ─── Commit Timeline ────────────────────────────────────────────── */
.commit-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.commit-item {
  display: flex;
  gap: 14px;
  padding: 10px 0;
  position: relative;
}

.commit-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 24px;
  bottom: -10px;
  width: 2px;
  background: var(--border);
}

.commit-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--text-3);
  background: var(--surface);
  flex-shrink: 0;
  margin-top: 4px;
  position: relative;
  z-index: 1;
}

.commit-dot.commit-head {
  border-color: var(--accent);
  background: var(--accent);
}

.commit-body {
  flex: 1;
  min-width: 0;
}

.commit-message {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 4px;
  word-break: break-word;
}

.commit-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.commit-author {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 500;
}

.commit-hash {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  color: var(--text-3);
}

.commit-date {
  font-size: 12px;
  color: var(--text-3);
}

.commit-refs {
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 1px 6px;
  border-radius: 4px;
}

.empty-inline {
  padding: 32px 0;
}

/* ─── Git 平台选择器 ──────────────────────────────────────────────── */
.platform-selector {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.platform-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 2px solid var(--border);
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 160px;
}

.platform-option:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.platform-option.active {
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 8%, transparent);
}

.platform-option.bound {
  background: var(--surface);
}

.platform-option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.platform-option-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.platform-option-user {
  font-size: 12px;
  color: var(--success);
}

.platform-option-unbound {
  font-size: 12px;
  color: var(--text-3);
}

.platform-check {
  color: var(--success);
}

/* ─── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
