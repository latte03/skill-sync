<script setup lang="ts">
import { computed, ref } from "vue";
import { RefreshOutline, WarningOutline } from "@vicons/ionicons5";
import { useToast } from "../composables/useToast";
import { api } from "../api";
import type { ConflictInfo } from "../api";
import PageHeader from "../components/ui/PageHeader.vue";
import UiButton from "../components/ui/UiButton.vue";
import UiSpin from "../components/ui/UiSpin.vue";
import UiIcon from '../components/ui/UiIcon.vue';

const message = useToast();
const conflicts = ref<ConflictInfo[]>([]);
const loading = ref(false);
const checked = ref(false);
const summary = computed(() =>
  conflicts.value.length === 0 && checked.value
    ? "未发现冲突"
    : `${conflicts.value.length} 项待处理`,
);
function label(type: ConflictInfo["type"]) {
  return {
    "managed-mismatch": "管理状态不一致",
    unmanaged: "未管理副本",
    "broken-symlink": "失效链接",
  }[type];
}
async function refresh() {
  loading.value = true;
  try {
    conflicts.value = (await api.getConflicts()).conflicts;
    checked.value = true;
  } catch (error) {
    message.error(`检测失败: ${(error as Error).message}`);
  } finally {
    loading.value = false;
  }
}
async function redeploy(conflict: ConflictInfo) {
  try {
    await api.deploySkill(conflict.skillName, [conflict.agent], {
      force: true,
    });
    message.success("已强制重新分发");
    await refresh();
  } catch (error) {
    message.error(`修复失败: ${(error as Error).message}`);
  }
}
async function remove(conflict: ConflictInfo) {
  try {
    await api.undeploySkill(conflict.skillName, [conflict.agent]);
    message.success("已移除该 Agent 中的副本");
    await refresh();
  } catch (error) {
    message.error(`移除失败: ${(error as Error).message}`);
  }
}
</script>

<template>
  <div class="app-page conflicts-page">
    <PageHeader
      eyebrow="一致性检查"
      title="一致性检查"
      summary="检查中央仓库与 Agent 目录，只呈现需要处理的差异。"
    >
      <template #actions>
        <UiButton variant="primary" size="sm" :loading="loading" @click="refresh">
          <template #icon><UiIcon :component="RefreshOutline" /></template>
          {{ checked ? "重新检查" : "开始检查" }}
        </UiButton>
      </template>
    </PageHeader>
    <section
      class="integrity-banner"
      :class="{
        'integrity-banner--clean': checked && conflicts.length === 0,
        'integrity-banner--idle': !checked,
      }"
    >
      <span class="integrity-icon"
        ><UiIcon :component="WarningOutline" size="16"
      /></span>
      <div>
        <strong>{{ summary }}</strong>
        <p>
          {{
            checked
              ? conflicts.length
                ? "逐项预览并收敛；操作范围仅限对应 Skill 与 Agent。"
                : "中央仓库与已检测 Agent 的分发状态一致。"
              : "尚未扫描当前工作区。"
          }}
        </p>
      </div>
      <small>{{ checked ? "刚刚完成检查" : "准备开始检查" }}</small>
    </section>
    <UiSpin :show="loading"
      ><section v-if="conflicts.length" class="conflict-list">
        <article
          v-for="conflict in conflicts"
          :key="`${conflict.skillName}:${conflict.agent}:${conflict.destPath}`"
          class="conflict-card"
        >
          <span class="conflict-dot" />
          <div>
            <p class="meta-label">{{ label(conflict.type) }}</p>
            <h2>
              {{ conflict.skillName }} <span>→ {{ conflict.agent }}</span>
            </h2>
            <p>{{ conflict.detail }}</p>
            <code>{{ conflict.destPath }}</code>
          </div>
          <div class="inline-actions">
            <UiButton size="sm" @click="redeploy(conflict)">重新分发</UiButton
            ><UiButton size="sm" variant="danger" @click="remove(conflict)">移除副本</UiButton>
          </div>
        </article>
      </section>
      <div v-else-if="checked" class="integrity-empty">
        <b>没有需要处理的差异</b><span>所有已检测分发目标状态一致。</span>
      </div></UiSpin
    >
  </div>
</template>

<style scoped>
.conflict-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}
.integrity-banner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  border: 1px solid
    color-mix(in srgb, var(--color-warning) 34%, var(--color-rule));
  border-radius: var(--radius-lg);
  background: var(--color-paper);
  padding: 0.72rem 0.8rem;
  box-shadow: var(--shadow-xs);
}
.integrity-banner--clean {
  border-color: color-mix(in srgb, var(--color-success) 30%, var(--color-rule));
}
.integrity-banner--idle {
  border-color: var(--color-rule);
}
.integrity-icon {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
.integrity-banner--clean .integrity-icon {
  background: var(--color-success-soft);
  color: var(--color-success);
}
.integrity-banner--idle .integrity-icon {
  background: var(--color-paper-2);
  color: var(--color-muted);
}
.integrity-banner strong {
  display: block;
  color: var(--color-ink);
  font-size: 0.75rem;
}
.integrity-banner p {
  margin: 0.1rem 0 0;
  color: var(--color-muted);
  font-size: 0.75rem;
}
.integrity-banner small {
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}
.conflict-list {
  display: grid;
  gap: 0.4rem;
}
.conflict-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-md);
  background: var(--color-paper);
  padding: 0.7rem;
  box-shadow: var(--shadow-xs);
}
.conflict-dot {
  width: 0.45rem;
  height: 0.45rem;
  align-self: start;
  margin-top: 0.15rem;
  border-radius: 999px;
  background: var(--color-warning);
  box-shadow: 0 0 0 4px var(--color-warning-soft);
}
.conflict-card h2 {
  margin: 0.15rem 0;
  color: var(--color-ink);
  font-size: 0.75rem;
  letter-spacing: -0.02em;
}
.conflict-card h2 span {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 400;
}
.conflict-card p:not(.meta-label) {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.75rem;
}
.conflict-card code {
  display: block;
  margin-top: 0.25rem;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
.integrity-empty {
  display: grid;
  min-height: 12rem;
  place-content: center;
  justify-items: center;
  gap: 0.2rem;
  color: var(--color-muted);
}
.integrity-empty b {
  color: var(--color-ink-2);
  font-size: 0.75rem;
}
.integrity-empty span {
  font-size: 0.75rem;
}
@media (max-width: 39.99rem) {
  .conflict-head {
    align-items: stretch;
    flex-direction: column;
  }
  .integrity-banner {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .integrity-banner small {
    grid-column: 2;
  }
  .conflict-card {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .conflict-card .inline-actions {
    grid-column: 2;
  }
}
</style>
