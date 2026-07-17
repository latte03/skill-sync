import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { api } from '../api';
import type { AgentInfo, SkillDetail, SkillInfo, StatusInfo } from '../api';

export function useSkillWorkspace(onError: (message: string) => void) {
  const loading = ref(false);
  const skills = ref<SkillInfo[]>([]);
  const agents = ref<AgentInfo[]>([]);
  const status = ref<StatusInfo | null>(null);
  const tags = ref<Record<string, string[]>>({});
  const query = shallowRef('');
  const agentFilter = shallowRef('');
  const tagFilter = shallowRef('');
  const selectedSkillKey = shallowRef<string | null>(null);
  const selectedDetail = ref<SkillDetail | null>(null);
  const detailLoading = ref(false);

  const installedAgents = computed(() => agents.value.filter(agent => agent.installed));
  const visibleSkills = computed(() => {
    const value = query.value.trim().toLowerCase();
    return skills.value.filter((skill) => (
      (!value || skill.name.toLowerCase().includes(value) || skill.description.toLowerCase().includes(value))
      && (!agentFilter.value || skill.agents.includes(agentFilter.value))
      && (!tagFilter.value || skill.tags.includes(tagFilter.value))
    ));
  });
  const selectedSkill = computed(() => skills.value.find(skill => skill.name === selectedSkillKey.value) ?? null);

  async function refresh() {
    loading.value = true;
    try {
      const [statusResponse, skillsResponse, agentsResponse, tagResponse] = await Promise.all([
        api.getStatus(), api.getSkills(), api.getAgents(), api.getTags(),
      ]);
      status.value = statusResponse;
      skills.value = skillsResponse.skills;
      agents.value = agentsResponse.agents;
      tags.value = tagResponse.tags;
    } catch (error) {
      onError(`加载 Skill 工作区失败: ${(error as Error).message}`);
    } finally {
      loading.value = false;
    }
  }

  async function selectSkill(skill: SkillInfo) {
    selectedSkillKey.value = skill.name;
    detailLoading.value = true;
    selectedDetail.value = null;
    try {
      selectedDetail.value = await api.getSkillDetail(skill.name);
    } catch (error) {
      onError(`加载 Skill 详情失败: ${(error as Error).message}`);
    } finally {
      detailLoading.value = false;
    }
  }

  function closeInspector() {
    selectedSkillKey.value = null;
    selectedDetail.value = null;
  }

  watch(visibleSkills, (next) => {
    if (selectedSkillKey.value && !next.some(skill => skill.name === selectedSkillKey.value)) closeInspector();
  });
  onMounted(refresh);

  return {
    loading, skills, agents, status, tags, query, agentFilter, tagFilter,
    installedAgents, visibleSkills, selectedSkill, selectedDetail, detailLoading,
    refresh, selectSkill, closeInspector,
  };
}
