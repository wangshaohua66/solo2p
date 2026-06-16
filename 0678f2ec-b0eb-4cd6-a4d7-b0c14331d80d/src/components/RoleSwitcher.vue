<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useApronStore } from '@/stores/apron';
import { USER_ROLES, USER_ROLE_LABELS } from '@/utils/constants';
import type { UserRole } from '@/types/apron';
import { User, ChevronDown, Check } from 'lucide-vue-next';

const store = useApronStore();
const showMenu = ref(false);
const menuRef = ref<HTMLDivElement | null>(null);
const buttonRef = ref<HTMLButtonElement | null>(null);

const toggleMenu = () => {
  showMenu.value = !showMenu.value;
};

const selectRole = (role: UserRole) => {
  store.setCurrentRole(role);
  showMenu.value = false;
};

const handleClickOutside = (e: MouseEvent) => {
  if (
    menuRef.value &&
    !menuRef.value.contains(e.target as Node) &&
    buttonRef.value &&
    !buttonRef.value.contains(e.target as Node)
  ) {
    showMenu.value = false;
  }
};

const roleDescriptions: Record<UserRole, string> = {
  dispatcher: '机位调度·航班监控',
  'ground-crew': '地勤作业·车辆调度',
  supervisor: '全局把控·统计分析',
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="role-switcher">
    <button
      ref="buttonRef"
      class="role-switcher-btn"
      @click="toggleMenu"
    >
      <div class="flex items-center gap-2">
        <div class="role-avatar">
          <User :size="16" />
        </div>
        <div class="text-left">
          <div class="role-name">{{ USER_ROLE_LABELS[store.currentRole] }}</div>
          <div class="role-desc">{{ roleDescriptions[store.currentRole] }}</div>
        </div>
      </div>
      <ChevronDown :size="16" class="text-gray-400 transition-transform" :class="{ 'rotate-180': showMenu }" />
    </button>

    <Transition name="dropdown">
      <div
        v-if="showMenu"
        ref="menuRef"
        class="role-menu"
      >
        <div class="menu-header">
          <p class="text-xs text-gray-400 uppercase tracking-wider">切换角色视图</p>
        </div>
        <div class="menu-items">
          <button
            v-for="role in USER_ROLES"
            :key="role"
            class="menu-item"
            :class="{ active: role === store.currentRole }"
            @click="selectRole(role)"
          >
            <div class="flex items-center gap-3 flex-1">
              <div
                class="role-icon"
                :class="{
                  'role-icon-dispatcher': role === 'dispatcher',
                  'role-icon-ground': role === 'ground-crew',
                  'role-icon-supervisor': role === 'supervisor',
                }"
              >
                <User :size="16" />
              </div>
              <div class="text-left">
                <div class="role-item-name">{{ USER_ROLE_LABELS[role] }}</div>
                <div class="role-item-desc">{{ roleDescriptions[role] }}</div>
              </div>
            </div>
            <Check
              v-if="role === store.currentRole"
              :size="18"
              class="text-cyan-400"
            />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.role-switcher {
  position: relative;
}

.role-switcher-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.role-switcher-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-light);
}

.role-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #06b6d4, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.role-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.role-desc {
  font-size: 10px;
  color: var(--color-text-muted);
  line-height: 1.2;
  margin-top: 2px;
}

.rotate-180 {
  transform: rotate(180deg);
}

.role-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 280px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}

.menu-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.menu-items {
  padding: 6px;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
}

.menu-item:hover {
  background: var(--color-bg-hover);
}

.menu-item.active {
  background: rgba(6, 182, 212, 0.1);
}

.role-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.role-icon-dispatcher {
  background: rgba(6, 182, 212, 0.2);
  color: #06b6d4;
}

.role-icon-ground {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.role-icon-supervisor {
  background: rgba(139, 92, 246, 0.2);
  color: #8b5cf6;
}

.role-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.role-item-desc {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.3;
  margin-top: 2px;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.gap-2 {
  gap: 0.5rem;
}

.gap-3 {
  gap: 0.75rem;
}

.flex-1 {
  flex: 1;
}

.flex-shrink-0 {
  flex-shrink: 0;
}

.text-left {
  text-align: left;
}

.transition-transform {
  transition: transform var(--transition-fast);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>
