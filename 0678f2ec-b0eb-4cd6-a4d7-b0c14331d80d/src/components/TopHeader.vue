<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useApronStore } from '@/stores/apron';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  AIRPORT_NAME,
  AIRPORT_CODE,
} from '@/utils/constants';
import { formatUTCTime, formatBeijingTime } from '@/utils/helpers';
import { Plane, Clock, User, ChevronDown, Save, Menu, PanelLeft, PanelRight } from 'lucide-vue-next';

const store = useApronStore();

const currentTime = ref(Date.now());
let timeInterval: NodeJS.Timeout | null = null;

const utcTime = computed(() => formatUTCTime(currentTime.value));
const beijingTime = computed(() => formatBeijingTime(currentTime.value));

const showRoleMenu = ref(false);

const toggleRoleMenu = () => {
  showRoleMenu.value = !showRoleMenu.value;
};

const selectRole = (role: string) => {
  store.setCurrentRole(role as any);
  showRoleMenu.value = false;
};

const saveLayout = () => {
  store.saveLayout();
};

const toggleLeftPanel = () => {
  store.toggleLeftPanel();
};

const toggleRightPanel = () => {
  store.toggleRightPanel();
};

onMounted(() => {
  timeInterval = setInterval(() => {
    currentTime.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval);
  }
});
</script>

<template>
  <header class="top-header">
    <div class="flex items-center gap-4">
      <button
        class="p-2 rounded-lg hover:bg-white/10 transition-colors lg:hidden"
        @click="toggleLeftPanel"
      >
        <Menu :size="20" />
      </button>

      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <Plane :size="22" class="text-white" />
        </div>
        <div>
          <h1 class="text-lg font-bold leading-tight">{{ AIRPORT_NAME }}</h1>
          <p class="text-xs text-gray-400 font-mono">{{ AIRPORT_CODE }} · 机坪运行监控中心</p>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-8">
      <div class="time-display">
        <div class="flex items-center gap-2">
          <Clock :size="16" class="text-gray-400" />
          <div class="flex flex-col items-end">
            <div class="flex items-center gap-3">
              <div>
                <span class="time-label">UTC</span>
                <span class="font-mono text-lg">{{ utcTime }}</span>
              </div>
              <div class="h-6 w-px bg-gray-600" />
              <div>
                <span class="time-label">北京</span>
                <span class="font-mono text-lg text-cyan-400">{{ beijingTime }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          class="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
          @click="toggleLeftPanel"
          title="切换左侧面板"
        >
          <PanelLeft :size="18" />
        </button>

        <button
          class="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
          @click="toggleRightPanel"
          title="切换右侧面板"
        >
          <PanelRight :size="18" />
        </button>

        <button
          class="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
          @click="saveLayout"
          title="保存布局"
        >
          <Save :size="18" />
          <span class="text-sm">保存布局</span>
        </button>

        <div class="relative">
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-tertiary hover:bg-bg-hover transition-colors border border-border"
            @click="toggleRoleMenu"
          >
            <User :size="18" class="text-gray-400" />
            <span class="text-sm">{{ USER_ROLE_LABELS[store.currentRole] }}</span>
            <ChevronDown :size="16" class="text-gray-400" />
          </button>

          <div
            v-if="showRoleMenu"
            class="absolute right-0 top-full mt-2 w-48 bg-bg-secondary border border-border rounded-lg shadow-lg z-50 overflow-hidden"
          >
            <button
              v-for="role in USER_ROLES"
              :key="role"
              class="w-full px-4 py-3 text-left text-sm hover:bg-bg-hover transition-colors flex items-center gap-2"
              :class="{ 'bg-bg-tertiary': role === store.currentRole }"
              @click="selectRole(role)"
            >
              <User
                :size="16"
                :class="role === store.currentRole ? 'text-cyan-400' : 'text-gray-400'"
              />
              {{ USER_ROLE_LABELS[role] }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.top-header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-xl);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  height: var(--header-height);
}

.bg-gradient-to-br {
  background: linear-gradient(135deg, #06b6d4, #2563eb);
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.justify-between {
  justify-content: space-between;
}

.gap-2 {
  gap: 0.5rem;
}

.gap-3 {
  gap: 0.75rem;
}

.gap-4 {
  gap: 1rem;
}

.gap-8 {
  gap: 2rem;
}

.w-10 {
  width: 2.5rem;
}

.h-10 {
  height: 2.5rem;
}

.rounded-xl {
  border-radius: 0.75rem;
}

.text-lg {
  font-size: 1.125rem;
}

.text-xs {
  font-size: 0.75rem;
}

.text-sm {
  font-size: 0.875rem;
}

.font-bold {
  font-weight: 700;
}

.leading-tight {
  line-height: 1.25;
}

.text-gray-400 {
  color: #94a3b8;
}

.text-cyan-400 {
  color: #22d3ee;
}

.text-white {
  color: #ffffff;
}

.time-display {
  font-family: var(--font-family-mono);
}

.time-label {
  font-size: 10px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  margin-right: 4px;
}

.h-6 {
  height: 1.5rem;
}

.w-px {
  width: 1px;
}

.bg-gray-600 {
  background-color: #475569;
}

.bg-bg-tertiary {
  background: var(--color-bg-tertiary);
}

.bg-bg-secondary {
  background: var(--color-bg-secondary);
}

.hover\:bg-bg-hover:hover {
  background: var(--color-bg-hover);
}

.border {
  border-width: 1px;
}

.border-border {
  border-color: var(--color-border);
}

.p-2 {
  padding: 0.5rem;
}

.px-3 {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.py-2 {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.px-4 {
  padding-left: 1rem;
  padding-right: 1rem;
}

.py-3 {
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}

.rounded-lg {
  border-radius: var(--radius-md);
}

.transition-colors {
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.relative {
  position: relative;
}

.absolute {
  position: absolute;
}

.right-0 {
  right: 0;
}

.top-full {
  top: 100%;
}

.mt-2 {
  margin-top: 0.5rem;
}

.w-48 {
  width: 12rem;
}

.shadow-lg {
  box-shadow: var(--shadow-lg);
}

.z-50 {
  z-index: 50;
}

.overflow-hidden {
  overflow: hidden;
}

.text-left {
  text-align: left;
}

.font-mono {
  font-family: var(--font-family-mono);
}

.flex-col {
  flex-direction: column;
}

.items-end {
  align-items: flex-end;
}

.hidden {
  display: none;
}

@media (min-width: 768px) {
  .md\:flex {
    display: flex;
  }
}

@media (min-width: 1024px) {
  .lg\:hidden {
    display: none;
  }
}
</style>
