/**
 * Naive UI provider — 按需引入组件
 *
 * 使用方式：在 main.ts 中 app.use(naive)
 * 组件会自动按需注册，无需单独导入
 */
import {
  create,
  // 基础
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  // 布局
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NLayoutSider,
  NGrid,
  NGridItem,
  NSpace,
  NDivider,
  // 数据展示
  NCard,
  NTable,
  NEmpty,
  NSpin,
  NTabs,
  NTabPane,
  NStatistic,
  NDescriptions,
  NDescriptionsItem,
  NTag,
  NThing,
  NCode,
  NTimeline,
  NTimelineItem,
  // 导航
  NBreadcrumb,
  NBreadcrumbItem,
  NDropdown,
  // 表单
  NButton,
  NButtonGroup,
  NInput,
  NInputGroup,
  NSelect,
  NSwitch,
  NCheckbox,
  NRadio,
  NRadioGroup,
  NForm,
  NFormItem,
  // 反馈
  NModal,
  NPopconfirm,
  NTooltip,
  NAlert,
  NResult,
  // 其他
  NIcon,
  NTransfer,
  NDynamicInput,
  NPopover,
  NMenu,
} from 'naive-ui';

export const naive = create({
  components: [
    // 基础
    NConfigProvider,
    NGlobalStyle,
    NMessageProvider,
    NDialogProvider,
    NNotificationProvider,
    // 布局
    NLayout,
    NLayoutHeader,
    NLayoutContent,
    NLayoutSider,
    NGrid,
    NGridItem,
    NSpace,
    NDivider,
    // 数据展示
    NCard,
    NTable,
    NEmpty,
    NSpin,
    NTabs,
    NTabPane,
    NStatistic,
    NDescriptions,
    NDescriptionsItem,
    NTag,
    NThing,
    NCode,
    NTimeline,
    NTimelineItem,
    // 导航
    NBreadcrumb,
    NBreadcrumbItem,
    NDropdown,
    // 表单
    NButton,
    NButtonGroup,
    NInput,
    NInputGroup,
    NSelect,
    NSwitch,
    NCheckbox,
    NRadio,
    NRadioGroup,
    NForm,
    NFormItem,
    // 反馈
    NModal,
    NPopconfirm,
    NTooltip,
    NAlert,
    NResult,
    // 其他
    NIcon,
    NTransfer,
    NDynamicInput,
    NPopover,
    NMenu,
  ],
});

export default naive;
