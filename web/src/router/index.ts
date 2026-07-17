/**
 * Vue Router 配置
 *
 * 路由命名规范：
 * - 页面组件使用 PascalCase（如 SkillDetailView）
 * - 路由 name 使用 camelCase（如 skillDetail）
 * - 路由 path 使用 kebab-case（如 /skill-detail）
 */

import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

// 同步导入首屏组件
import SkillsView from '../views/SkillsView.vue';
import StatusView from '../views/StatusView.vue';

// 异步导入非首屏组件
const SearchView = () => import('../views/SearchView.vue');
const ManageView = () => import('../views/ManageView.vue');
const ConflictsView = () => import('../views/ConflictsView.vue');
const SkillDetailView = () => import('../views/SkillDetailView.vue');
const SyncView = () => import('../views/SyncView.vue');
const SettingsView = () => import('../views/SettingsView.vue');

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/skills',
  },
  {
    path: '/skills',
    name: 'skills',
    component: SkillsView,
    meta: {
      title: '技能库',
      subtitle: '集中查看 Skill 的来源、版本与分发覆盖',
      navKey: 'skills',
    },
  },
  {
    path: '/skills/:name',
    name: 'skillDetail',
    component: SkillDetailView,
    props: true,
    meta: {
      title: 'Skill 详情',
      subtitle: '在一个工作台完成来源、更新、依赖与分发操作',
      navKey: 'skills',
    },
  },
  {
    path: '/search',
    name: 'search',
    component: SearchView,
    meta: {
      title: '发现与安装',
      subtitle: '从本地与 skills.sh 发现可安装的 Skill',
      navKey: 'search',
    },
  },
  {
    path: '/manage',
    name: 'manage',
    component: ManageView,
    meta: {
      title: '分发管理',
      subtitle: '从 Skill 与 Agent 两个视角管理分发覆盖',
      navKey: 'manage',
    },
  },
  {
    path: '/sync',
    name: 'sync',
    component: SyncView,
    meta: {
      title: '远程同步',
      subtitle: '首次完成远程配置，之后只关注同步健康度',
      navKey: 'sync',
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: {
      title: '设置',
      subtitle: '配置 Git 平台、AI 提供商与网络代理',
      navKey: 'settings',
    },
  },
  {
    path: '/conflicts',
    name: 'conflicts',
    component: ConflictsView,
    meta: {
      title: '一致性检查',
      subtitle: '检查并收敛中央仓库与 Agent 目录的不一致',
      navKey: 'conflicts',
    },
  },
  {
    path: '/status',
    name: 'status',
    component: StatusView,
    meta: {
      title: 'Agent 状态',
      subtitle: '查看已检测 Agent、覆盖密度与工作区状态',
      navKey: 'status',
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    // 始终滚动到顶部
    return { top: 0 };
  },
});

// 路由守卫：更新页面标题
router.beforeEach((to) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} - SkillSync`;
  }
});

export default router;
