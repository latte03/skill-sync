# Graph Report - .  (2026-07-16)

## Corpus Check
- 108 files · ~65,397 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 769 nodes · 2087 edges · 35 communities (27 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- CLI Commands
- Configuration and Git
- Gitignore Safety Audit
- Core Workflow and Scanning
- Installation and Dependencies
- Search and Network API
- Settings UI
- Web Application Shell
- Management UI
- Shared Domain Types
- Sync UI
- Product Documentation
- Skill Details UI
- Frontend Tooling
- Logging
- Package Scripts
- Root TypeScript Config
- Skills List UI
- Web TypeScript Config
- Package Metadata
- Runtime Dependencies
- Conflict Resolution UI
- Legacy Migration
- Status UI
- Storage Data Model
- Namespace Refactor
- Core Context
- Server Tests
- Web Environment Types
- Vite Configuration
- Release History
- pnpm Workspace
- Web Entry HTML

## God Nodes (most connected - your core abstractions)
1. `readConfig()` - 33 edges
2. `createContext()` - 32 edges
3. `getHomeDir()` - 24 edges
4. `getLockEntry()` - 23 edges
5. `initCommand()` - 22 edges
6. `handleCommandError()` - 22 edges
7. `skillRepoPath()` - 22 edges
8. `deploySkill()` - 20 edges
9. `getAgents()` - 20 edges
10. `readLock()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Git Identity Credential Binding Interface` --conceptually_related_to--> `Git Synchronization Mechanism`  [INFERRED]
  image.png → docs/design-sync-git.md
- `GitPlatformsResponse` --references--> `GitPlatformInfo`  [EXTRACTED]
  web/src/api.ts → src/lib/types.ts
- `AIProvidersResponse` --references--> `AIProviderInfo`  [EXTRACTED]
  web/src/api.ts → src/lib/types.ts
- `SkillSync Development Guide` --references--> `Distribution Mechanism`  [EXTRACTED]
  AGENT.md → docs/design-distribution.md
- `SkillSync Development Guide` --references--> `SkillSync v1.2 Product Requirements`  [EXTRACTED]
  AGENT.md → PRD-SkillSync-v1.2.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Central Skill Lifecycle** — prd_skillsync_v1_2_manifest_lock_model, docs_design_integration_skills_sh_integration, docs_design_distribution_distribution_mechanism, docs_design_version_management_version_management_design [EXTRACTED 1.00]
- **Safe Distribution Pattern** — docs_design_distribution_platform_link_strategy, docs_design_distribution_source_hash, docs_design_distribution_undeploy_preserved_copy [EXTRACTED 1.00]

## Communities (35 total, 8 thin omitted)

### Community 0 - "CLI Commands"
Cohesion: 0.10
Nodes (45): program, checkCommand(), cleanCommand(), formatSize(), getDirSize(), deployCommand(), undeployCommand(), importCommand() (+37 more)

### Community 1 - "Configuration and Git"
Cohesion: 0.09
Nodes (57): configCommand(), getNestedValue(), parseValue(), setNestedValue(), syncCommand(), deepMerge(), getDefaultConfig(), getGitHubToken() (+49 more)

### Community 2 - "Gitignore Safety Audit"
Cohesion: 0.09
Nodes (49): checkGitignoreCommand(), CheckGitignoreOpts, checkGitignoreRules(), CheckResult, FORBIDDEN_ALLOW_PATTERNS, getCorrectGitignoreContent(), GitignoreCheckSummary, GitignoreRule (+41 more)

### Community 3 - "Core Workflow and Scanning"
Cohesion: 0.14
Nodes (44): switchCommand(), createTestContext(), SkillSyncContext, discoverLocalSkills(), installLocalSkill(), filterManaged(), filterUnmanaged(), groupBySkillName() (+36 more)

### Community 4 - "Installation and Dependencies"
Cohesion: 0.08
Nodes (47): buildSkillEntry(), detectDefaultAgents(), discoverGitHubSkills(), downloadGitHubSkill(), finalizeInstall(), installFromDiscovered(), installGitHubSkill(), isEmptyDependenciesSafe() (+39 more)

### Community 5 - "Search and Network API"
Cohesion: 0.10
Nodes (30): printLocalResults(), printRemoteResults(), searchCommand(), downloadFileWithProxy(), fetchJsonWithProxy(), findSkillMdPaths(), getProxyUrl(), isProxyEnabled() (+22 more)

### Community 6 - "Settings UI"
Cohesion: 0.07
Nodes (35): activateProvider(), activatingId, activeGitPlatform, activeModel, activeProvider, addingCustom, addProvider(), binding (+27 more)

### Community 7 - "Web Application Shell"
Cohesion: 0.06
Nodes (27): activeTheme, activeThemeOverrides, darkOverrides, isActiveNav, isDark, lightOverrides, NavItem, navItems (+19 more)

### Community 8 - "Management UI"
Cohesion: 0.07
Nodes (30): addTagToSkill(), agentOptions, agents, allTags, confirmDeploy(), confirmUndeploy(), createTagForSelected(), deployLoading (+22 more)

### Community 9 - "Shared Domain Types"
Cohesion: 0.09
Nodes (29): AgentConfig, AgentInfo, AgentStatus, AIConfig, AIProviderConfig, AIProviderInfo, ChangedFile, Dependency (+21 more)

### Community 10 - "Sync UI"
Cohesion: 0.07
Nodes (27): SyncCommit, containerStyle, fallback, ICON_MAP, props, svgContent, activePlatform, commitMessage (+19 more)

### Community 11 - "Product Documentation"
Cohesion: 0.07
Nodes (32): Active Initiative Workflow, PRD-Compliant Git Commit Format, SkillSync Development Guide, Isolated Skill Test Environment, Project Analysis Report, Document and Implementation Gaps, Distribution Mechanism, Platform Link Strategy (+24 more)

### Community 12 - "Skill Details UI"
Cohesion: 0.10
Nodes (20): agentOptions, agents, deployLoading, detail, doDeploy(), doUndeploy(), emit, loadDetail() (+12 more)

### Community 13 - "Frontend Tooling"
Cohesion: 0.09
Nodes (22): devDependencies, concurrently, @lobehub/icons-static-svg, md-editor-v3, msw, naive-ui, standard-version, @types/node (+14 more)

### Community 14 - "Logging"
Cohesion: 0.13
Nodes (4): ConsoleLogger, Logger, LogLevel, SilentLogger

### Community 15 - "Package Scripts"
Cohesion: 0.11
Nodes (19): scripts, build, build:all, build:web, dev, dev:all, dev:mock, dev:web (+11 more)

### Community 16 - "Root TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+8 more)

### Community 17 - "Skills List UI"
Cohesion: 0.12
Nodes (12): agentOptions, filterAgent, filteredSkills, filterTag, filterText, loading, message, router (+4 more)

### Community 18 - "Web TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit, resolveJsonModule (+7 more)

### Community 19 - "Package Metadata"
Cohesion: 0.17
Nodes (11): bin, skill-sync, description, engines, node, files, keywords, license (+3 more)

### Community 20 - "Runtime Dependencies"
Cohesion: 0.17
Nodes (12): dependencies, chalk, cli-table3, commander, hono, @hono/node-server, inquirer, open (+4 more)

### Community 21 - "Conflict Resolution UI"
Cohesion: 0.20
Nodes (9): ConflictInfo, api, conflicts, hasChecked, loading, message, refresh(), resolveForceDeploy() (+1 more)

### Community 22 - "Legacy Migration"
Cohesion: 0.20
Nodes (7): lock, LOCK_PATH, NEW_HOME_DIR, NEW_SKILLS_DIR, OLD_SKILLS_DIR, oldDirs, SKIP_DIRS

### Community 23 - "Status UI"
Cohesion: 0.20
Nodes (7): StatusInfo, UpdateCheckResult, loading, message, status, updateLoading, updateResults

### Community 24 - "Storage Data Model"
Cohesion: 0.67
Nodes (3): Filesystem as Source of Truth, Namespace Collision Decision, Manifest and Lock Data Model

## Knowledge Gaps
- **248 isolated node(s):** `name`, `version`, `description`, `type`, `skill-sync` (+243 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GitPlatformInfo` connect `Shared Domain Types` to `Configuration and Git`, `Sync UI`, `Settings UI`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `SkillInfo` connect `Shared Domain Types` to `Management UI`, `Skills List UI`, `Core Workflow and Scanning`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `UpdateCheckResult` connect `Status UI` to `Shared Domain Types`, `Core Workflow and Scanning`, `Skill Details UI`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _265 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CLI Commands` be split into smaller, more focused modules?**
  _Cohesion score 0.0996488147497805 - nodes in this community are weakly interconnected._
- **Should `Configuration and Git` be split into smaller, more focused modules?**
  _Cohesion score 0.08857808857808858 - nodes in this community are weakly interconnected._
- **Should `Gitignore Safety Audit` be split into smaller, more focused modules?**
  _Cohesion score 0.09275793650793651 - nodes in this community are weakly interconnected._