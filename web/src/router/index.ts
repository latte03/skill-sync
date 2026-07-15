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
      title: 'Skills',
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
      navKey: 'skills',
    },
  },
  {
    path: '/search',
    name: 'search',
    component: SearchView,
    meta: {
      title: '搜索',
      navKey: 'search',
    },
  },
  {
    path: '/manage',
    name: 'manage',
    component: ManageView,
    meta: {
      title: '管理',
      navKey: 'manage',
    },
  },
  {
    path: '/sync',
    name: 'sync',
    component: SyncView,
    meta: {
      title: '同步',
      navKey: 'sync',
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: {
      title: '设置',
      navKey: 'settings',
    },
  },
  {
    path: '/conflicts',
    name: 'conflicts',
    component: ConflictsView,
    meta: {
      title: '冲突',
      navKey: 'conflicts',
    },
  },
  {
    path: '/status',
    name: 'status',
    component: StatusView,
    meta: {
      title: '状态',
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
