<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import {
  DocumentTextOutline,
  FolderOutline,
  FolderOpenOutline,
  CodeSlashOutline,
} from '@vicons/ionicons5';
import UiIcon from '../ui/UiIcon.vue';
import { MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/preview.css';
import { api } from '../../api';
import type { SkillFileEntry } from '../../api';

const props = defineProps<{ name: string }>();

const files = ref<SkillFileEntry[]>([]);
const loading = ref(false);
const activeFile = ref<string | null>(null);
const fileContent = ref<string | null>(null);
const fileLoading = ref(false);
const fileError = ref<string | null>(null);
const expandedDirs = ref<Set<string>>(new Set());

const isMarkdown = computed(() => activeFile.value?.endsWith('.md') ?? false);

/** Parse YAML frontmatter into key-value pairs for styled display */
const frontmatter = computed<Array<{ key: string; value: string }>>(() => {
  if (!fileContent.value || !isMarkdown.value) return [];
  const match = fileContent.value.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .filter(line => line.includes(':'))
    .map(line => {
      const idx = line.indexOf(':');
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    });
});

/** Markdown body without frontmatter */
const renderedMd = computed(() => {
  if (!fileContent.value) return '';
  return fileContent.value.replace(/^---\n[\s\S]*?\n---\n?/, '');
});

async function loadFiles() {
  loading.value = true;
  try {
    const res = await api.getSkillFiles(props.name);
    files.value = res.files;
    // Auto-select SKILL.md if present
    const skillMd = res.files.find(f => f.name === 'SKILL.md');
    if (skillMd) await selectFile(skillMd.path);
  } catch {
    files.value = [];
  } finally {
    loading.value = false;
  }
}

async function selectFile(filePath: string) {
  activeFile.value = filePath;
  fileLoading.value = true;
  fileError.value = null;
  fileContent.value = null;
  try {
    const res = await api.getSkillFileContent(props.name, filePath);
    fileContent.value = res.content;
  } catch (e) {
    fileError.value = (e as Error).message;
  } finally {
    fileLoading.value = false;
  }
}

function toggleDir(dirPath: string) {
  if (expandedDirs.value.has(dirPath)) {
    expandedDirs.value.delete(dirPath);
  } else {
    expandedDirs.value.add(dirPath);
  }
}

function fileIcon(entry: SkillFileEntry) {
  if (entry.type === 'directory') {
    return expandedDirs.value.has(entry.path) ? FolderOpenOutline : FolderOutline;
  }
  if (entry.name.endsWith('.md')) return DocumentTextOutline;
  return CodeSlashOutline;
}

function formatSize(bytes?: number) {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

watch(() => props.name, loadFiles, { immediate: true });
</script>

<template>
  <div class="file-browser">
    <!-- File list -->
    <div class="file-list">
      <div class="file-list-head">
        <span>Files</span>
        <span class="file-count">{{ files.length }}</span>
      </div>
      <div v-if="loading" class="file-loading">加载中…</div>
      <template v-else>
        <template v-for="entry in files" :key="entry.path">
          <button
            type="button"
            class="file-item"
            :class="{ 'file-item--active': activeFile === entry.path }"
            @click="entry.type === 'directory' ? toggleDir(entry.path) : selectFile(entry.path)"
          >
            <UiIcon :component="fileIcon(entry)" size="15" class="file-icon" />
            <span class="file-name">{{ entry.name }}</span>
            <span v-if="entry.type === 'file'" class="file-size">{{ formatSize(entry.size) }}</span>
          </button>
          <!-- Nested children -->
          <template v-if="entry.type === 'directory' && expandedDirs.has(entry.path) && entry.children">
            <button
              v-for="child in entry.children"
              :key="child.path"
              type="button"
              class="file-item file-item--nested"
              :class="{ 'file-item--active': activeFile === child.path }"
              @click="child.type === 'directory' ? toggleDir(child.path) : selectFile(child.path)"
            >
              <UiIcon :component="fileIcon(child)" size="14" class="file-icon" />
              <span class="file-name">{{ child.name }}</span>
              <span v-if="child.type === 'file'" class="file-size">{{ formatSize(child.size) }}</span>
            </button>
          </template>
        </template>
      </template>
    </div>

    <!-- File preview -->
    <div class="file-preview">
      <template v-if="activeFile">
        <div class="preview-head">
          <code>{{ activeFile }}</code>
        </div>
        <div class="preview-body">
          <div v-if="fileLoading" class="file-loading">加载中…</div>
          <div v-else-if="fileError" class="file-error">{{ fileError }}</div>
          <template v-else-if="isMarkdown">
            <div v-if="frontmatter.length" class="fm-block">
              <div v-for="field in frontmatter" :key="field.key" class="fm-row">
                <span class="fm-key">{{ field.key }}</span>
                <span class="fm-val">{{ field.value }}</span>
              </div>
            </div>
            <MdPreview :model-value="renderedMd" preview-theme="default" />
          </template>
          <pre v-else class="code-block"><code>{{ fileContent }}</code></pre>
        </div>
      </template>
      <div v-else class="preview-empty">选择文件以预览内容</div>
    </div>
  </div>
</template>

<style scoped>
.file-browser { display: grid; grid-template-rows: auto 1fr; border: 1px solid var(--color-rule); border-radius: var(--radius-md); overflow: hidden; min-height: 24rem; }

/* File list */
.file-list { border-bottom: 1px solid var(--color-rule); max-height: 14rem; overflow-y: auto; }
.file-list-head { display: flex; align-items: center; justify-content: space-between; padding: .5rem .75rem; border-bottom: 1px solid var(--color-rule); }
.file-list-head span:first-child { color: var(--color-ink); font-size: var(--text-xs); font-weight: 650; text-transform: uppercase; letter-spacing: .04em; }
.file-count { color: var(--color-faint); font-size: var(--text-xs); font-family: var(--font-mono); }
.file-loading { padding: .75rem; color: var(--color-faint); font-size: var(--text-xs); }

.file-item { display: flex; align-items: center; gap: .5rem; width: 100%; border: 0; background: transparent; padding: .35rem .75rem; cursor: pointer; text-align: left; transition: background var(--dur-fast); }
.file-item:hover { background: var(--color-paper-2); }
.file-item--active { background: var(--color-accent-soft); }
.file-item--active .file-name { color: var(--color-accent); }
.file-item--nested { padding-left: 1.75rem; }
.file-icon { flex: none; color: var(--color-faint); }
.file-item--active .file-icon { color: var(--color-accent); }
.file-name { flex: 1; min-width: 0; color: var(--color-ink-2); font-size: var(--text-xs); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { flex: none; color: var(--color-faint); font-size: .6rem; font-family: var(--font-mono); }

/* Preview */
.file-preview { display: grid; grid-template-rows: auto 1fr; min-height: 0; overflow: hidden; }
.preview-head { padding: .2rem .55rem; border-bottom: 1px solid var(--color-rule); background: var(--color-paper-2);font-size:var(--text-sm);border-radius:8px; margin:8px}
.preview-head code { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-muted); }
.preview-body { overflow-y: auto; min-height: 0; }
.preview-body :deep(.md-editor-preview) { padding: 1rem 1.25rem; background: transparent; font-size: var(--text-sm); }
.preview-body :deep(.md-editor) { background: transparent; }
.fm-block { margin: .75rem 1.25rem 0; padding: .5rem .75rem; border: 1px solid var(--color-rule); border-radius: var(--radius-sm); background: var(--color-paper-2); display: grid; gap: .25rem; }
.fm-row { display: flex; align-items: baseline; gap: .5rem; }
.fm-key { flex: none; min-width: 5.5rem; color: var(--color-faint); font-size: var(--text-xs); font-weight: 550; font-family: var(--font-mono); }
.fm-val { color: var(--color-ink-2); font-size: var(--text-xs); line-height: 1.4; word-break: break-all; }
.code-block { margin: 0; padding: 1rem 1.25rem; overflow-x: auto; font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.6; color: var(--color-ink-2); white-space: pre-wrap; word-break: break-all; }
.preview-empty { display: grid; place-items: center; padding: 3rem; color: var(--color-faint); font-size: var(--text-xs); }
.file-error { padding: 1rem; color: var(--color-danger); font-size: var(--text-xs); }
</style>
