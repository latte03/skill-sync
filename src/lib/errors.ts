/**
 * 自定义错误类型
 *
 * 参考 PRD §15 错误处理设计
 */

/** 退出码枚举（PRD §16） */
export const ExitCode = {
  SUCCESS: 0,
  CONFIG_NOT_INITIALIZED: 2,
  SKILL_NOT_FOUND: 3,
  AGENT_NOT_FOUND: 4,
  DEPENDENCY_MISSING: 5,
  NETWORK_ERROR: 6,
  PERMISSION_DENIED: 7,
  SYNC_CONFLICT: 8,
  VERSION_CONFLICT: 9,
  INVALID_INPUT: 10,
  UNKNOWN: 1,
} as const;

export type ExitCodeType = (typeof ExitCode)[keyof typeof ExitCode];

/** SkillSync 基础错误 */
export class SkillSyncError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCodeType = ExitCode.UNKNOWN,
    public readonly details?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** 配置未初始化 */
export class ConfigNotInitializedError extends SkillSyncError {
  constructor() {
    super('SkillSync 尚未初始化，请先运行 `skill-sync init`', ExitCode.CONFIG_NOT_INITIALIZED);
  }
}

/** Skill 未找到 */
export class SkillNotFoundError extends SkillSyncError {
  constructor(name: string) {
    super(`Skill 未找到: ${name}`, ExitCode.SKILL_NOT_FOUND);
  }
}

/** Agent 未找到 */
export class AgentNotFoundError extends SkillSyncError {
  constructor(name: string) {
    super(`未知 Agent: ${name}`, ExitCode.AGENT_NOT_FOUND);
  }
}

/** 依赖缺失 */
export class DependencyMissingError extends SkillSyncError {
  constructor(depName: string, skillName: string) {
    super(
      `Skill "${skillName}" 依赖 "${depName}"，但该依赖未安装`,
      ExitCode.DEPENDENCY_MISSING,
    );
  }
}

/** 网络错误 */
export class NetworkError extends SkillSyncError {
  constructor(message: string, details?: string) {
    super(message, ExitCode.NETWORK_ERROR, details);
  }
}

/** 权限错误 */
export class PermissionDeniedError extends SkillSyncError {
  constructor(path: string) {
    super(`权限不足: ${path}`, ExitCode.PERMISSION_DENIED);
  }
}

/** 同步冲突 */
export class SyncConflictError extends SkillSyncError {
  constructor(files: string[]) {
    super(
      `同步冲突，涉及文件: ${files.join(', ')}`,
      ExitCode.SYNC_CONFLICT,
    );
  }
}

/** 版本冲突 */
export class VersionConflictError extends SkillSyncError {
  constructor(skillName: string, current: string, requested: string) {
    super(
      `版本冲突: ${skillName} 当前版本 ${current}，请求版本 ${requested}`,
      ExitCode.VERSION_CONFLICT,
    );
  }
}

/** 输入无效 */
export class InvalidInputError extends SkillSyncError {
  constructor(message: string) {
    super(message, ExitCode.INVALID_INPUT);
  }
}
