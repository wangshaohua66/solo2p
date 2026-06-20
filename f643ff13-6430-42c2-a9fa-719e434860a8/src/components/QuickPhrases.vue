<template>
  <div class="quick-phrases">
    <div class="phrases-header">
      <span class="title">快捷短语</span>
      <button class="btn-add" @click="showAddModal = true" title="添加短语">
        +
      </button>
    </div>

    <div class="categories">
      <button
        v-for="cat in categories"
        :key="cat"
        class="category-btn"
        :class="{ active: selectedCategory === cat }"
        @click="selectedCategory = cat"
      >
        {{ cat }}
      </button>
    </div>

    <div class="phrases-list" ref="listRef">
      <div
        v-for="phrase in filteredPhrases"
        :key="phrase.id"
        class="phrase-item"
        @click="handlePhraseClick(phrase.id)"
      >
        <span class="phrase-content">{{ phrase.content }}</span>
        <span class="phrase-count">{{ phrase.usageCount }}</span>
      </div>
      <div v-if="filteredPhrases.length === 0" class="empty-state">
        暂无快捷短语
      </div>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3>添加快捷短语</h3>
        <div class="form-group">
          <label>短语内容</label>
          <textarea
            v-model="newPhraseContent"
            placeholder="输入快捷短语内容..."
            rows="3"
          ></textarea>
        </div>
        <div class="form-group">
          <label>分类</label>
          <select v-model="newPhraseCategory">
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ cat }}
            </option>
            <option value="自定义">自定义</option>
          </select>
        </div>
        <div v-if="newPhraseCategory === '自定义'" class="form-group">
          <label>自定义分类名</label>
          <input v-model="newCustomCategory" type="text" placeholder="输入分类名称" />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showAddModal = false">取消</button>
          <button
            class="btn-confirm"
            @click="addPhrase"
            :disabled="!newPhraseContent.trim() || !getFinalCategory()"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTranscriptStore } from '@/stores/transcriptStore'

const emit = defineEmits<{
  (e: 'select', content: string): void
}>()

const transcriptStore = useTranscriptStore()

const showAddModal = ref(false)
const selectedCategory = ref('全部')
const newPhraseContent = ref('')
const newPhraseCategory = ref('庭审流程')
const newCustomCategory = ref('')
const listRef = ref<HTMLElement | null>(null)

const categories = computed(() => {
  const cats = new Set<string>()
  cats.add('全部')
  transcriptStore.quickPhrases.forEach(p => cats.add(p.category))
  return Array.from(cats)
})

const filteredPhrases = computed(() => {
  let phrases = [...transcriptStore.quickPhrases]
  if (selectedCategory.value !== '全部') {
    phrases = phrases.filter(p => p.category === selectedCategory.value)
  }
  return phrases.sort((a, b) => b.usageCount - a.usageCount)
})

const getFinalCategory = () => {
  if (newPhraseCategory.value === '自定义') {
    return newCustomCategory.value.trim()
  }
  return newPhraseCategory.value
}

const handlePhraseClick = (id: string) => {
  const content = transcriptStore.useQuickPhrase(id)
  if (content) {
    emit('select', content)
  }
}

const addPhrase = () => {
  const category = getFinalCategory()
  if (newPhraseContent.value.trim() && category) {
    transcriptStore.addQuickPhrase(newPhraseContent.value.trim(), category)
    showAddModal.value = false
    newPhraseContent.value = ''
    newPhraseCategory.value = '庭审流程'
    newCustomCategory.value = ''
  }
}
</script>

<style lang="scss" scoped>
.quick-phrases {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--card-bg);
  border-radius: 8px;
  overflow: hidden;
}

.phrases-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);

  .title {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 14px;
  }

  .btn-add {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: var(--primary-color);
    color: white;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;

    &:hover {
      background: var(--primary-hover);
    }
  }
}

.categories {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.category-btn {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--hover-bg);
  }

  &.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }
}

.phrases-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.phrase-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: background 0.2s;
  margin-bottom: 4px;

  &:hover {
    background: var(--hover-bg);
  }

  .phrase-content {
    flex: 1;
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .phrase-count {
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--input-bg);
    padding: 2px 6px;
    border-radius: 10px;
    flex-shrink: 0;
  }
}

.empty-state {
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 40px 20px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 24px;
  min-width: 380px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);

  h3 {
    margin: 0 0 20px 0;
    color: var(--text-primary);
    font-size: 16px;
  }
}

.form-group {
  margin-bottom: 16px;

  label {
    display: block;
    margin-bottom: 6px;
    color: var(--text-secondary);
    font-size: 13px;
  }

  textarea, input, select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 14px;
    box-sizing: border-box;
    font-family: inherit;
    resize: vertical;

    &:focus {
      outline: none;
      border-color: var(--primary-color);
    }
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn-cancel, .btn-confirm {
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  border: none;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--input-bg);
  color: var(--text-primary);

  &:hover {
    background: var(--hover-bg);
  }
}

.btn-confirm {
  background: var(--primary-color);
  color: white;

  &:hover {
    background: var(--primary-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
