/**
 * 核心层导出
 */

export { createContext, createTestContext } from './context.js';
export type { SkillSyncContext } from './context.js';

export {
  scanAgentSkills,
  scanAllAgents,
  scanAgents,
  filterUnmanaged,
  filterManaged,
  groupBySkillName,
} from './scanner.js';

export {
  resolveDeployMode,
  createLink,
  removeLink,
  computeSourceHash,
  listSkills,
  getSkillDetail,
  deploySkill,
  undeploySkill,
  importSkill,
  removeSkill,
  createBackup,
  listBackups,
} from './skill-manager.js';

export {
  discoverLocalSkills,
  discoverGitHubSkills,
  downloadGitHubSkill,
  installLocalSkill,
  installGitHubSkill,
} from './installer.js';

export {
  checkForUpdate,
  checkAllUpdates,
  updateSkill,
  updateAllSkills,
  listSkillBackups,
  restoreFromBackup,
} from './version-manager.js';

export {
  isGitInitialized,
  initGit,
  getSyncStatus,
  pushSync,
  pullSync,
  getRemotes,
  setRemoteUrl,
  getCommitLog,
  getBranchInfo,
  getChangedFiles,
  getGitDiff,
} from './sync-manager.js';
export type { GitCommitInfo, GitRemoteInfo, GitBranchInfo } from './sync-manager.js';
