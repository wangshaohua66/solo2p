import http from './http'
import type { GlazeRecipe, PagedResult, PagedQuery } from '@/types'

export const glazeRecipeApi = {
  getRecipes(params?: {
    keyword?: string
    firingType?: string
    isArchived?: boolean
  } & PagedQuery): Promise<PagedResult<GlazeRecipe>> {
    return http.get('/glaze-recipes', { params })
  },

  getRecipe(id: string): Promise<GlazeRecipe> {
    return http.get(`/glaze-recipes/${id}`)
  },

  getRecipeTree(rootId?: string): Promise<GlazeRecipe[]> {
    return http.get('/glaze-recipes/tree', { params: { rootId } })
  },

  createRecipe(data: Partial<GlazeRecipe>): Promise<GlazeRecipe> {
    return http.post('/glaze-recipes', data)
  },

  updateRecipe(id: string, data: Partial<GlazeRecipe>): Promise<GlazeRecipe> {
    return http.put(`/glaze-recipes/${id}`, data)
  },

  deleteRecipe(id: string): Promise<void> {
    return http.delete(`/glaze-recipes/${id}`)
  },

  cloneRecipe(id: string, newName: string): Promise<GlazeRecipe> {
    return http.post(`/glaze-recipes/${id}/clone`, { newName })
  },

  createVersion(parentId: string, data: Partial<GlazeRecipe>): Promise<GlazeRecipe> {
    return http.post(`/glaze-recipes/${parentId}/version`, data)
  },

  archiveRecipe(id: string): Promise<GlazeRecipe> {
    return http.post(`/glaze-recipes/${id}/archive`)
  },

  unarchiveRecipe(id: string): Promise<GlazeRecipe> {
    return http.post(`/glaze-recipes/${id}/unarchive`)
  },

  getRecipeVersions(id: string): Promise<GlazeRecipe[]> {
    return http.get(`/glaze-recipes/${id}/versions`)
  },

  getRecipeLineage(id: string): Promise<GlazeRecipe[]> {
    return http.get(`/glaze-recipes/${id}/lineage`)
  },

  uploadEffectImage(id: string, file: File): Promise<{ imageUrl: string }> {
    const formData = new FormData()
    formData.append('file', file)
    return http.post(`/glaze-recipes/${id}/effect-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}
