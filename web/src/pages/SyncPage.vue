<template>
  <div class="sync-page">
    <!-- ─── Page Header ─── -->
    <div class="page-header">
      <h3>Git 同步</h3>
      <n-button size="small" quaternary @click="refreshAll" :loading="loading">
        刷新
      </n-button>
    </div>

    <n-spin :show="loading">
      <!-- ─── Not Initialized ─── -->
      <div v-if="!loading && status && !status.isRepo" class="empty-card">
        <n-icon size="48" color="#86868b">
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
          <div class="stat-card" :style="{ '--accent': '#007AFF' }">
            <div class="stat-icon-wrap">
              <n-icon size="20" color="#007AFF"><GitBranchOutline /></n-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ status.branch ?? '—' }}</span>
              <span class="stat-label">当前分支</span>
            </div>
          </div>

          <div class="stat-card" :style="{ '--accent': status.ahead > 0 ? '#FF9500' : '#34C759' }">
            <div class="stat-icon-wrap">
              <n-icon size="20" :color="status.ahead > 0 ? '#FF9500' : '#34C759'">
                <ArrowUpCircleOutline />
              </n-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ status.ahead }}</span>
              <span class="stat-label">领先远程</span>
            </div>
          </div>

          <div class="stat-card" :style="{ '--accent': status.behind > 0 ? '#FF9500' : '#34C759' }">
            <div class="stat-icon-wrap">
              <n-icon size="20" :color="status.behind > 0 ? '#FF9500' : '#34C759'">
                <ArrowDownCircleOutline />
              </n-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ status.behind }}</span>
              <span class="stat-label">落后远程</span>
            </div>
          </div>

          <div class="stat-card" :style="{ '--accent': status.uncommittedChanges > 0 ? '#FF9500' : '#34C759' }">
            <div class="stat-icon-wrap">
              <n-icon size="20" :color="status.uncommittedChanges > 0 ? '#FF9500' : '#34C759'">
                <DocumentTextOutline />
              </n-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ status.uncommittedChanges }}</span>
              <span class="stat-label">未提交变更</span>
            </div>
          </div>
        </div>

        <!-- ─── Sync Actions ─── -->
        <div class="section-card">
          <div class="section-header">
            <n-icon size="18" color="#007AFF"><CloudUploadOutline /></n-icon>
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
              <n-icon size="14" color="#FF9500"><AlertCircleOutline /></n-icon>
              <span>尚未配置远程仓库，请在下方设置远程仓库地址</span>
            </div>
          </div>
        </div>

        <!-- ─── Remote Config ─── -->
        <div class="section-card">
          <div class="section-header">
            <n-icon size="18" color="#5856D6"><GitNetworkOutline /></n-icon>
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
            <n-icon size="18" color="#FF9500"><DocumentTextOutline /></n-icon>
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
            <n-icon size="18" color="#34C759"><TimeOutline /></n-icon>
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
import { ref, onMounted } from 'vue';
import { useMessage } from 'naive-ui';
import {
  GitBranchOutline,
  GitNetworkOutline,
  CloudUploadOutline,
  CloudDownloadOutline,
  ArrowUpCircleOutline,
  ArrowDownCircleOutline,
  DocumentTextOutline,
  TimeOutline,
  AlertCircleOutline,
  SparklesOutline,
} from '@vicons/ionicons5';
import { api, type SyncStatusInfo, type SyncCommit } from '../api';

const message = useMessage();

const loading = ref(false);
const status = ref<SyncStatusInfo | null>(null);
const commits = ref<SyncCommit[]>([]);
const commitMessage = ref('');
const remoteUrl = ref('');

const pushLoading = ref(false);
const pullLoading = ref(false);
const initLoading = ref(false);
const remoteLoading = ref(false);
const generatingCommit = ref(false);

async function refreshAll() {
  loading.value = true;
  try {
    const [statusRes, logRes] = await Promise.all([
      api.getSyncStatus(),
      api.getSyncLog(30),
    ]);
    status.value = statusRes;
    commits.value = logRes.commits;
  } catch (e) {
    message.error(`加载失败: ${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
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

/* ─── Page Header ────────────────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.01em;
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

.empty-title {
  margin: 8px 0 0;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}

.empty-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #86868b;
}

/* ─── Stats Grid ─────────────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.60);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.stat-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  flex-shrink: 0;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #1d1d1f;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-label {
  font-size: 12px;
  color: #86868b;
  font-weight: 500;
}

/* ─── Section Card ───────────────────────────────────────────────── */
.section-card {
  padding: 18px 20px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
  margin-bottom: 14px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
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

.no-remote-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #c26e00;
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
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.03);
}

.remote-name {
  font-size: 13px;
  font-weight: 600;
  color: #1d1d1f;
  min-width: 60px;
}

.remote-url {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: #007aff;
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
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-untracked {
  background: rgba(52, 199, 89, 0.12);
  color: #248a3d;
}

.status-modified {
  background: rgba(255, 149, 0, 0.12);
  color: #c26e00;
}

.status-deleted {
  background: rgba(255, 59, 48, 0.12);
  color: #c3271f;
}

.status-staged {
  background: rgba(0, 122, 255, 0.12);
  color: #0055b3;
}

.file-path {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: #6e6e73;
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
  background: rgba(0, 0, 0, 0.06);
}

.commit-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #86868b;
  background: #fff;
  flex-shrink: 0;
  margin-top: 4px;
  position: relative;
  z-index: 1;
}

.commit-dot.commit-head {
  border-color: #007aff;
  background: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.12);
}

.commit-body {
  flex: 1;
  min-width: 0;
}

.commit-message {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
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
  color: #6e6e73;
  font-weight: 500;
}

.commit-hash {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  color: #86868b;
}

.commit-date {
  font-size: 12px;
  color: #86868b;
}

.commit-refs {
  font-size: 10px;
  font-weight: 600;
  color: #007aff;
  background: rgba(0, 122, 255, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
}

.empty-inline {
  padding: 32px 0;
}

/* ─── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
