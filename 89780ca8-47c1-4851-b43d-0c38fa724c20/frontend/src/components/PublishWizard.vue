<template>
  <div class="glass p-5">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2">
        <div
          v-for="s in 4"
          :key="s"
          class="h-1.5 rounded-full transition-all duration-300"
          :style="s <= store.publishStep + 1
            ? 'background: linear-gradient(135deg, var(--gold), var(--gold-light)); width: 60px;'
            : 'background: var(--border-color); width: 60px;'"
        />
      </div>
      <span class="text-xs" style="color: var(--text-muted);">Step {{ store.publishStep + 1 }} of 4</span>
    </div>

    <div v-if="store.publishStep === 0" class="fade-in-up">
      <h3 class="text-lg font-semibold mb-4" style="font-family: 'Playfair Display', serif;">Upload Artwork</h3>
      <div
        class="border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer"
        style="border-color: var(--border-color);"
        :style="isDragging ? 'border-color: var(--gold); background: rgba(212, 168, 83, 0.05);' : ''"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
        @click="fileInput?.click()"
      >
        <Upload :size="40" class="mx-auto mb-3" style="color: var(--text-muted);" />
        <p class="text-sm" style="color: var(--text-secondary);">Drag & drop your artwork here</p>
        <p class="text-xs mt-1" style="color: var(--text-muted);">PNG, JPG, GIF, SVG up to 50MB</p>
      </div>
      <input ref="fileInput" type="file" class="hidden" accept="image/*" @change="handleFileSelect" />
      <div v-if="store.publishForm.imageUrl" class="mt-4">
        <img :src="store.publishForm.imageUrl" class="w-32 h-32 object-cover rounded-lg mx-auto" />
      </div>
    </div>

    <div v-else-if="store.publishStep === 1" class="fade-in-up">
      <h3 class="text-lg font-semibold mb-4" style="font-family: 'Playfair Display', serif;">Set Attributes</h3>
      <div class="space-y-4">
        <div>
          <label class="text-xs block mb-1" style="color: var(--text-muted);">Name</label>
          <input v-model="store.publishForm.name" class="w-full" placeholder="Collection name" />
        </div>
        <div>
          <label class="text-xs block mb-1" style="color: var(--text-muted);">Description</label>
          <textarea v-model="store.publishForm.description" class="w-full" rows="3" placeholder="Describe your collection..."></textarea>
        </div>
        <div>
          <label class="text-xs block mb-1" style="color: var(--text-muted);">Rarity</label>
          <select v-model="store.publishForm.rarity" class="w-full">
            <option value="common">Common</option>
            <option value="rare">Rare</option>
            <option value="epic">Epic</option>
            <option value="legendary">Legendary</option>
          </select>
        </div>
        <div>
          <label class="text-xs block mb-1" style="color: var(--text-muted);">Limited Count</label>
          <input v-model.number="store.publishForm.limitedCount" type="number" class="w-full" min="1" />
        </div>
        <div>
          <label class="text-xs block mb-1" style="color: var(--text-muted);">Royalty Rate: {{ store.publishForm.royaltyRate }}%</label>
          <input
            v-model.number="store.publishForm.royaltyRate"
            type="range"
            min="5"
            max="15"
            step="0.5"
            class="w-full"
            style="accent-color: var(--gold);"
          />
          <div class="flex justify-between text-xs" style="color: var(--text-muted);">
            <span>5%</span><span>15%</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="store.publishStep === 2" class="fade-in-up">
      <h3 class="text-lg font-semibold mb-4" style="font-family: 'Playfair Display', serif;">Preview</h3>
      <div class="glass-card p-4 max-w-xs mx-auto">
        <div class="rounded-lg overflow-hidden mb-3" style="aspect-ratio: 1;">
          <img
            v-if="store.publishForm.imageUrl"
            :src="store.publishForm.imageUrl"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center" style="background: var(--border-color);">
            <Image :size="48" style="color: var(--text-muted);" />
          </div>
        </div>
        <span
          class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white mb-2"
          :class="`badge-${store.publishForm.rarity}`"
        >
          {{ store.publishForm.rarity }}
        </span>
        <h4 class="text-base font-semibold" style="color: var(--text-primary);">{{ store.publishForm.name || 'Untitled' }}</h4>
        <p class="text-xs mt-1" style="color: var(--text-secondary);">{{ store.publishForm.description || 'No description' }}</p>
        <div class="flex justify-between mt-3 text-xs" style="color: var(--text-muted);">
          <span>Count: {{ store.publishForm.limitedCount }}</span>
          <span>Royalty: {{ store.publishForm.royaltyRate }}%</span>
        </div>
      </div>
    </div>

    <div v-else class="fade-in-up text-center py-8">
      <h3 class="text-lg font-semibold mb-2" style="font-family: 'Playfair Display', serif;">Confirm & Submit</h3>
      <p class="text-sm mb-6" style="color: var(--text-secondary);">Review your collection details and submit for review.</p>
      <div class="glass p-4 text-left max-w-md mx-auto mb-6">
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span style="color: var(--text-muted);">Name</span><span>{{ store.publishForm.name }}</span></div>
          <div class="flex justify-between"><span style="color: var(--text-muted);">Rarity</span><span>{{ store.publishForm.rarity }}</span></div>
          <div class="flex justify-between"><span style="color: var(--text-muted);">Count</span><span>{{ store.publishForm.limitedCount }}</span></div>
          <div class="flex justify-between"><span style="color: var(--text-muted);">Royalty</span><span>{{ store.publishForm.royaltyRate }}%</span></div>
        </div>
      </div>
    </div>

    <div class="flex justify-between mt-6">
      <button
        v-if="store.publishStep > 0"
        class="px-6 py-2 rounded-lg text-sm"
        style="border: 1px solid var(--border-color); color: var(--text-secondary);"
        @click="store.prevStep()"
      >
        Previous
      </button>
      <div v-else></div>
      <button
        v-if="store.publishStep < 3"
        class="gold-btn text-sm px-6 py-2"
        @click="store.nextStep()"
      >
        Next Step
      </button>
      <button
        v-else
        class="gold-btn text-sm px-8 py-2"
        :disabled="store.loading"
        @click="store.submitCollection()"
      >
        {{ store.loading ? 'Submitting...' : 'Submit Collection' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Upload, Image } from 'lucide-vue-next'
import { useCreatorStore } from '@/stores/creator'

const store = useCreatorStore()
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) processFile(file)
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) processFile(file)
}

function processFile(file: File) {
  store.publishForm.image = file
  const reader = new FileReader()
  reader.onload = (e) => {
    store.publishForm.imageUrl = e.target?.result as string
  }
  reader.readAsDataURL(file)
}
</script>
