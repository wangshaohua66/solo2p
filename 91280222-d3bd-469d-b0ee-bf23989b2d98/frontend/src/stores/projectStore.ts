import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project } from '@/types/project'
import { projectApi, type CreateProjectRequest, type UpdateProjectRequest } from '@/api/project'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const isLoading = ref(false)

  const projectTree = computed(() => {
    return projects.value.map((p) => ({
      id: p.id,
      label: p.name,
      status: p.status,
      children: []
    }))
  })

  const sortedProjects = computed(() => {
    return [...projects.value].sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  })

  async function fetchProjects(params?: { status?: string; keyword?: string }) {
    isLoading.value = true
    try {
      const result = await projectApi.list(params)
      projects.value = (result as any).data || result
      return projects.value
    } finally {
      isLoading.value = false
    }
  }

  async function fetchProject(id: string) {
    isLoading.value = true
    try {
      const result = await projectApi.get(id)
      currentProject.value = (result as any).data || result
      return currentProject.value
    } finally {
      isLoading.value = false
    }
  }

  async function createProject(data: CreateProjectRequest) {
    const result = await projectApi.create(data)
    const project = (result as any).data || result
    projects.value.push(project)
    return project
  }

  async function updateProject(id: string, data: UpdateProjectRequest) {
    const result = await projectApi.update(id, data)
    const project = (result as any).data || result
    const index = projects.value.findIndex((p) => p.id === id)
    if (index !== -1) {
      projects.value[index] = project
    }
    if (currentProject.value?.id === id) {
      currentProject.value = project
    }
    return project
  }

  async function deleteProject(id: string) {
    await projectApi.delete(id)
    projects.value = projects.value.filter((p) => p.id !== id)
    if (currentProject.value?.id === id) {
      currentProject.value = null
    }
  }

  function setCurrentProject(project: Project | null) {
    currentProject.value = project
  }

  return {
    projects,
    currentProject,
    isLoading,
    projectTree,
    sortedProjects,
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject
  }
})
