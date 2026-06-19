<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSnippetStore } from '@/stores/snippets'
import { useEditorStore } from '@/stores/editor'
import { useAnnotationStore } from '@/stores/annotation'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseTag from '@/components/common/BaseTag.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { LANGUAGES, type Snippet, type LanguageId, ANNOTATION_COLORS } from '@/types'
import { validateTags, validateImportFile, readFileAsText, parseJsonSafe } from '@/utils/storage'
import {
  Plus, Search, FolderPlus, FolderOpen, ChevronDown, ChevronRight,
  Star, StarOff, Edit3, Trash2, Copy, Download, Upload,
  Code2, Sparkles
} from 'lucide-vue-next'

const snippetStore = useSnippetStore()
const editorStore = useEditorStore()
const annotationStore = useAnnotationStore()

const activeTab = ref<'snippets' | 'presets'>('snippets')
const searchQuery = ref('')
const showFormDialog = ref(false)
const editingSnippet = ref<Snippet | null>(null)
const showImportDialog = ref(false)

const formData = ref({
  name: '',
  code: '',
  language: 'javascript' as LanguageId,
  tags: [] as string[],
  categoryId: '',
  description: '',
  favorite: false
})
const formErrors = ref<string[]>([])
const newTagInput = ref('')

watch(activeTab, (t) => { snippetStore.setActivePanelTab(t) })
watch(searchQuery, (q) => { snippetStore.setSearchQuery(q) })
watch(() => snippetStore.selectedCategoryId, (id) => {
  if (id) formData.value.categoryId = id
}, { immediate: true })

const filteredSnippets = computed(() => snippetStore.filteredSnippets)
const categories = computed(() => snippetStore.categories)

function openCreate() {
  editingSnippet.value = null
  formData.value = {
    name: '',
    code: editorStore.activeContent.substring(0, 1000),
    language: editorStore.activeLanguage as LanguageId || 'javascript',
    tags: [],
    categoryId: snippetStore.selectedCategoryId || snippetStore.categories[0]?.id || '',
    description: '',
    favorite: false
  }
  newTagInput.value = ''
  formErrors.value = []
  showFormDialog.value = true
}

function openEdit(s: Snippet) {
  editingSnippet.value = s
  formData.value = {
    name: s.name,
    code: s.code,
    language: s.language,
    tags: [...s.tags],
    categoryId: s.categoryId,
    description: s.description,
    favorite: s.favorite
  }
  newTagInput.value = ''
  formErrors.value = []
  showFormDialog.value = true
}

function addTag() {
  const t = newTagInput.value.trim()
  if (!t) return
  const v = validateTags([t])
  if (!v.valid) {
    formErrors.value = v.errors
    return
  }
  if (!formData.value.tags.includes(t)) {
    formData.value.tags.push(t)
  }
  newTagInput.value = ''
}

function removeTag(t: string) {
  const idx = formData.value.tags.indexOf(t)
  if (idx >= 0) formData.value.tags.splice(idx, 1)
}

function submitForm() {
  const snippet = editingSnippet.value
  if (snippet) {
    const result = snippetStore.updateSnippet(snippet.id, formData.value)
    if (!result.success) {
      formErrors.value = result.errors || []
      return
    }
  } else {
    const result = snippetStore.addSnippet(formData.value)
    if (!result.success) {
      formErrors.value = result.errors || []
      return
    }
  }
  showFormDialog.value = false
}

function useSnippet(s: Snippet) {
  const content = s.code
  if (editorStore.activeFile) {
    const lang = s.language
    editorStore.createFile(`from-${s.name}.${LANGUAGES.find(l => l.id === lang)?.ext || 'js'}`, lang, content)
  }
}

function toggleFavorite(id: string, e: MouseEvent) {
  e.stopPropagation()
  snippetStore.toggleFavorite(id)
}

function duplicateSnippet(id: string, e: MouseEvent) {
  e.stopPropagation()
  snippetStore.duplicateSnippet(id)
}

function deleteSnippet(id: string, e: MouseEvent) {
  e.stopPropagation()
  if (confirm('确定要删除这个代码片段吗？')) {
    snippetStore.deleteSnippet(id)
  }
}

function toggleCategory(id: string) {
  snippetStore.toggleCategoryExpand(id)
}

function selectCategory(id: string) {
  snippetStore.selectedCategoryId = snippetStore.selectedCategoryId === id ? null : id
}

function addCategory() {
  const name = prompt('请输入分类名称:', '新分类')
  if (name && name.trim()) {
    snippetStore.addCategory(name.trim())
  }
}

function exportAll() {
  snippetStore.exportSnippets()
}

function startImport() {
  showImportDialog.value = true
}

async function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const v = validateImportFile(file)
  if (!v.valid) {
    alert(v.errors.join('\n'))
    return
  }
  const text = await readFileAsText(file)
  const data = parseJsonSafe<{ snippets?: Snippet[]; categories?: any[] }>(text, undefined as any)
  if (!data || !Array.isArray(data.snippets)) {
    alert('文件格式无效')
    return
  }
  const result = await snippetStore.importSnippets(file)
  alert(result.success
    ? `成功导入 ${result.imported || 0} 个片段`
    : result.errors?.join('\n') || '导入失败')
  showImportDialog.value = false
}

const tagColors = ANNOTATION_COLORS
function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = ((hash << 5) - hash) + tag.charCodeAt(i)
  return tagColors[Math.abs(hash) % tagColors.length]
}
</script>

<template>
  <div class="flex flex-col h-full" style="background: var(--bg-secondary);">
    <div
      class="flex border-b"
      style="border-color: var(--border-color);"
    >
      <button
        v-for="t in [{ id: 'snippets' as const, icon: Code2, label: '代码片段' }, { id: 'presets' as const, icon: Sparkles, label: '标注预设' }]"
        :key="t.id"
        class="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2"
        :class="activeTab === t.id
          ? 'text-brand-400 border-brand-500'
          : 'border-transparent hover:bg-slate-700/20'"
        :style="{ color: activeTab === t.id ? undefined : 'var(--text-secondary)' }"
        @click="activeTab = t.id"
      >
        <component :is="t.icon" class="w-3.5 h-3.5" />
        <span>{{ t.label }}</span>
      </button>
    </div>

    <div class="flex-1 overflow-hidden flex flex-col">
      <div v-if="activeTab === 'snippets'" class="flex-1 flex flex-col overflow-hidden">
        <div
          class="p-2.5 border-b space-y-2"
          style="border-color: var(--border-color);"
        >
          <div class="relative">
            <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style="color: var(--text-secondary);" />
            <BaseInput
              v-model="searchQuery"
              placeholder="搜索片段、标签..."
              size="sm"
            />
          </div>
          <div class="flex items-center justify-between">
            <button
              class="btn-ghost text-xs flex items-center gap-1"
              title="切换收藏过滤"
              @click="snippetStore.favoriteOnly = !snippetStore.favoriteOnly"
            >
              <Star v-if="snippetStore.favoriteOnly" class="w-3.5 h-3.5 text-warning fill-warning" />
              <StarOff v-else class="w-3.5 h-3.5" />
              <span>仅收藏</span>
            </button>
            <div class="flex items-center gap-1">
              <button
                class="btn-icon"
                title="导入片段"
                @click="startImport"
              >
                <Upload class="w-3.5 h-3.5" />
              </button>
              <button
                class="btn-icon"
                title="导出全部"
                @click="exportAll"
              >
                <Download class="w-3.5 h-3.5" />
              </button>
              <button
                class="btn-icon"
                title="新建片段"
                @click="openCreate"
              >
                <Plus class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div v-if="snippetStore.selectedTags.length > 0" class="flex flex-wrap gap-1">
            <BaseTag
              v-for="t in snippetStore.selectedTags"
              :key="t"
              :text="t"
              :color="tagColor(t)"
              size="sm"
              closable
              @close="snippetStore.toggleTag(t)"
            />
            <button
              class="text-[10px] px-1.5 rounded ml-1 hover:opacity-80"
              style="color: var(--text-secondary);"
              @click="snippetStore.clearFilters"
            >
              清除全部
            </button>
          </div>
        </div>

        <div
          class="border-b max-h-[110px] overflow-y-auto scrollbar-thin"
          style="border-color: var(--border-color);"
        >
          <div class="p-1">
            <div class="flex items-center justify-between px-1.5 py-1 rounded hover:bg-slate-700/30 cursor-pointer group">
              <div
                class="flex items-center gap-1.5 text-xs"
                :style="{ color: snippetStore.selectedCategoryId === null ? 'var(--accent-color)' : 'var(--text-secondary)' }"
                @click="selectCategory('' as any)"
              >
                <FolderOpen class="w-3 h-3" />
                <span>全部片段</span>
                <span class="text-[10px] opacity-60 ml-1">({{ snippetStore.snippets.length }})</span>
              </div>
              <button
                class="opacity-0 group-hover:opacity-100 transition-opacity"
                @click.stop="addCategory"
              >
                <FolderPlus class="w-3 h-3" style="color: var(--text-secondary);" />
              </button>
            </div>
            <div
              v-for="cat in categories"
              :key="cat.id"
              class="pl-0.5"
            >
              <div
                class="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-700/30 cursor-pointer text-xs"
                :style="{ color: snippetStore.selectedCategoryId === cat.id ? 'var(--accent-color)' : 'var(--text-secondary)' }"
                @click="selectCategory(cat.id)"
              >
                <button
                  class="p-0.5"
                  @click.stop="toggleCategory(cat.id)"
                >
                  <ChevronDown v-if="cat.expanded" class="w-3 h-3" />
                  <ChevronRight v-else class="w-3 h-3" />
                </button>
                <component :is="cat.expanded ? FolderOpen : FolderOpen" class="w-3 h-3" />
                <span class="flex-1 truncate">{{ cat.name }}</span>
                <span class="text-[10px] opacity-60">
                  ({{ snippetStore.snippets.filter(s => s.categoryId === cat.id).length }})
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
          <div
            v-for="s in filteredSnippets"
            :key="s.id"
            class="card p-2.5 cursor-pointer hover:border-brand-500/60 transition-all group"
            style="border-width: 1px;"
            @click="useSnippet(s)"
          >
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-0.5">
                  <span
                    class="font-semibold text-sm truncate"
                    style="color: var(--text-primary);"
                  >{{ s.name }}</span>
                  <button
                    class="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    @click.stop="toggleFavorite(s.id, $event)"
                  >
                    <Star v-if="s.favorite" class="w-3.5 h-3.5 text-warning fill-warning" />
                    <StarOff v-else class="w-3.5 h-3.5" style="color: var(--text-secondary);" />
                  </button>
                </div>
                <div
                  v-if="s.description"
                  class="text-[11px] truncate"
                  style="color: var(--text-secondary);"
                >{{ s.description }}</div>
              </div>
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button class="btn-icon" style="width: 24px; height: 24px;" title="复制" @click.stop="duplicateSnippet(s.id, $event)">
                  <Copy class="w-3 h-3" />
                </button>
                <button class="btn-icon" style="width: 24px; height: 24px;" title="编辑" @click.stop="openEdit(s)">
                  <Edit3 class="w-3 h-3" />
                </button>
                <button class="btn-icon" style="width: 24px; height: 24px;" title="删除" @click.stop="deleteSnippet(s.id, $event)">
                  <Trash2 class="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
            <pre
              class="text-[10px] font-mono rounded px-2 py-1.5 mb-1.5 overflow-hidden max-h-[60px] leading-relaxed"
              style="background: var(--bg-primary); color: var(--text-secondary);"
            ><code>{{ s.code.slice(0, 160) }}{{ s.code.length > 160 ? '...' : '' }}</code></pre>
            <div class="flex items-center justify-between gap-2">
              <div class="flex flex-wrap gap-1">
                <BaseTag
                  v-for="t in s.tags.slice(0, 3)"
                  :key="t"
                  :text="t"
                  :color="tagColor(t)"
                  size="sm"
                />
                <span
                  v-if="s.tags.length > 3"
                  class="text-[10px]"
                  style="color: var(--text-secondary);"
                >+{{ s.tags.length - 3 }}</span>
              </div>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded uppercase font-medium"
                style="background: var(--bg-tertiary); color: var(--text-secondary);"
              >{{ s.language }}</span>
            </div>
          </div>
          <div
            v-if="filteredSnippets.length === 0"
            class="text-center py-10 text-xs"
            style="color: var(--text-secondary);"
          >
            <Code2 class="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>没有找到匹配的代码片段</p>
            <button class="btn-primary mt-3 text-xs" @click="openCreate">
              <Plus class="w-3 h-3" /> 新建片段
            </button>
          </div>
        </div>
      </div>

      <div v-else class="flex-1 flex flex-col p-2.5 overflow-y-auto scrollbar-thin">
        <div
          v-if="annotationStore.presets && annotationStore.presets.length > 0"
          class="grid grid-cols-2 gap-2 mb-2"
        >
          <div
            v-for="p in annotationStore.presets"
            :key="p.id"
            class="card p-2 text-xs cursor-pointer hover:border-brand-500/50 transition-colors"
          >
            <div class="font-medium truncate mb-1" style="color: var(--text-primary);">{{ p.name }}</div>
            <div class="text-[10px] opacity-60">{{ p.annotations.length }}个标注</div>
          </div>
        </div>
        <div
          class="flex-1 flex flex-col items-center justify-center text-xs text-center"
          style="color: var(--text-secondary);"
        >
          <Sparkles class="w-10 h-10 opacity-30 mb-2" />
          <p>标注预设功能</p>
          <p class="mt-1 opacity-60">在标注模式中点击「保存为预设」</p>
        </div>
      </div>
    </div>

    <BaseDialog
      v-model="showFormDialog"
      :title="editingSnippet ? '编辑代码片段' : '新建代码片段'"
      width="560px"
    >
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">
            名称 <span class="text-red-400">*</span>
          </label>
          <BaseInput v-model="formData.name" placeholder="请输入片段名称" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">
              分类 <span class="text-red-400">*</span>
            </label>
            <select
              v-model="formData.categoryId"
              class="input-field text-sm"
            >
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">
              语言 <span class="text-red-400">*</span>
            </label>
            <select
              v-model="formData.language"
              class="input-field text-sm"
            >
              <option v-for="l in LANGUAGES" :key="l.id" :value="l.id">{{ l.label }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">
            代码 <span class="text-red-400">*</span>
          </label>
          <textarea
            v-model="formData.code"
            rows="7"
            class="input-field font-mono text-xs resize-none"
            placeholder="粘贴代码内容..."
          />
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">标签</label>
          <div class="flex items-center gap-2 mb-1.5">
            <BaseInput
              v-model="newTagInput"
              size="sm"
              placeholder="输入标签后按回车添加"
              @enter="addTag"
            />
            <BaseButton variant="secondary" size="sm" @click="addTag">添加</BaseButton>
          </div>
          <div v-if="formData.tags.length > 0" class="flex flex-wrap gap-1">
            <BaseTag
              v-for="t in formData.tags"
              :key="t"
              :text="t"
              :color="tagColor(t)"
              size="sm"
              closable
              @close="removeTag(t)"
            />
          </div>
          <div v-else class="text-[10px] opacity-50">支持中英文、数字、下划线、短横线</div>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">描述（可选）</label>
          <textarea
            v-model="formData.description"
            rows="2"
            class="input-field text-xs resize-none"
            placeholder="简要描述这个片段的用途..."
          />
        </div>
        <label class="flex items-center gap-2 text-xs cursor-pointer" style="color: var(--text-secondary);">
          <input type="checkbox" v-model="formData.favorite" class="accent-brand-500" />
          <span>设为收藏（优先显示）</span>
        </label>
        <div
          v-if="formErrors.length > 0"
          class="p-2.5 rounded-md text-xs space-y-1"
          style="background: rgba(239, 68, 68, 0.12); color: #f87171;"
        >
          <p v-for="(e, i) in formErrors" :key="i">• {{ e }}</p>
        </div>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="showFormDialog = false">取消</BaseButton>
        <BaseButton variant="primary" @click="submitForm">
          {{ editingSnippet ? '保存修改' : '创建片段' }}
        </BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog
      v-model="showImportDialog"
      title="导入代码片段"
      width="440px"
    >
      <div class="space-y-3 text-center py-4">
        <Upload class="w-12 h-12 mx-auto opacity-40" />
        <div class="text-sm" style="color: var(--text-primary);">选择 JSON 文件导入代码片段</div>
        <div class="text-xs opacity-60">支持格式：CodeStage导出的 .json 文件，最大 10MB</div>
        <label class="btn-primary inline-flex cursor-pointer mt-2">
          <Plus class="w-4 h-4" />
          选择文件
          <input
            type="file"
            accept=".json,application/json"
            class="hidden"
            @change="onImportFile"
          />
        </label>
      </div>
    </BaseDialog>
  </div>
</template>
