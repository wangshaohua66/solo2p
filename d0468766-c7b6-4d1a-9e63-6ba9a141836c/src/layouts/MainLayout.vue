<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, RouterLink, RouterView, useRouter } from 'vue-router'
import { useAppStore, ROLE_META } from '@/stores/app'
import * as ElIcons from '@element-plus/icons-vue'
import type { UserRole } from '@/types'
import { ElDropdown, type DropdownMenuCommand } from 'element-plus'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const menus = [
  { index: '/dashboard', title: '运营驾驶舱', icon: 'Odometer' },
  { index: '/schedule', title: '智能排片', icon: 'Calendar' },
  { index: '/booking', title: '在线选座', icon: 'Film' },
  { index: '/dcp', title: 'DCP调度', icon: 'Box' },
  { index: '/member', title: '会员通兑', icon: 'Medal' },
  { index: '/concession', title: '卖品进销存', icon: 'Goods' },
  { index: '/analytics', title: '票房数据中心', icon: 'TrendCharts' },
  { index: '/monitor', title: '影厅监控', icon: 'Monitor' }
]

const filteredMenus = computed(() => menus.filter((m) => appStore.canAccess(m.index)))
const currentTitle = computed(() => (route.meta.title as string) || '光影院线')

const roleOptions = computed(() =>
  (Object.keys(ROLE_META) as UserRole[]).map((r) => ({
    label: ROLE_META[r].label,
    value: r,
    icon: r === appStore.role ? 'Check' : 'CircleClose'
  }))
)

function handleRoleCommand(cmd: DropdownMenuCommand | string | number | object) {
  const r = cmd as UserRole
  appStore.setRole(r)
  if (!appStore.canAccess(route.path)) {
    const firstAllowed = appStore.allowedRoutes[0] || '/dashboard'
    router.push(firstAllowed)
  }
}
</script>

<template>
  <div class="layout" :class="{ collapsed: appStore.collapsed }">
    <!-- 胶片齿孔侧边装饰 -->
    <div class="perforations left" aria-hidden="true">
      <span v-for="n in 16" :key="n" />
    </div>

    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">
          <svg viewBox="0 0 40 40" width="34" height="34">
            <defs>
              <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#f0c75e" />
                <stop offset="1" stop-color="#b8881f" />
              </linearGradient>
            </defs>
            <rect x="3" y="6" width="34" height="28" rx="4" fill="none" stroke="url(#bg)" stroke-width="2" />
            <circle cx="20" cy="20" r="8" fill="none" stroke="url(#bg)" stroke-width="2" />
            <circle cx="20" cy="20" r="2.5" fill="url(#bg)" />
            <rect x="3" y="10" width="3" height="2" fill="url(#bg)" />
            <rect x="3" y="28" width="3" height="2" fill="url(#bg)" />
            <rect x="34" y="10" width="3" height="2" fill="url(#bg)" />
            <rect x="34" y="28" width="3" height="2" fill="url(#bg)" />
          </svg>
        </div>
        <transition name="fade">
          <div v-show="!appStore.collapsed" class="brand-text">
            <h1 class="display gold-text">光影</h1>
            <span>院线运营平台</span>
          </div>
        </transition>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="m in filteredMenus"
          :key="m.index"
          :to="m.index"
          class="nav-item"
          :class="{ active: route.path.startsWith(m.index) }"
        >
          <component :is="(ElIcons as any)[m.icon]" class="nav-icon" />
          <transition name="fade">
            <span v-show="!appStore.collapsed" class="nav-label">{{ m.title }}</span>
          </transition>
          <span class="nav-glow" aria-hidden="true" />
        </RouterLink>
      </nav>

      <div class="sidebar-foot">
        <el-dropdown trigger="click" @command="handleRoleCommand">
          <div class="role-card" v-show="!appStore.collapsed">
            <div class="role-avatar" :style="{ color: appStore.roleMeta.color, borderColor: appStore.roleMeta.color }">{{ appStore.roleMeta.avatar }}</div>
            <div class="role-info">
              <strong>{{ appStore.roleMeta.label }}</strong>
              <span>{{ appStore.roleMeta.desc }}</span>
            </div>
            <component :is="(ElIcons as any).CaretBottom" class="caret" />
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="r in (Object.keys(ROLE_META) as UserRole[])"
                :key="r"
                :command="r"
              >
                <span class="role-switch-item" :style="{ color: ROLE_META[r].color }">{{ ROLE_META[r].avatar }}</span>
                {{ ROLE_META[r].label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="collapse-btn" @click="appStore.toggleSidebar()" aria-label="折叠菜单">
          <component :is="(ElIcons as any)[appStore.collapsed ? 'Expand' : 'Fold']" />
        </button>
        <div class="page-title">
          <span class="title-deco" aria-hidden="true" />
          <h2 class="display">{{ currentTitle }}</h2>
        </div>
        <div class="topbar-right">
          <div class="quick-stat">
            <span class="qs-label">今日票房</span>
            <span class="qs-value num">¥248.6万</span>
          </div>
          <el-badge :value="6" class="bell-badge">
            <button class="icon-btn"><component :is="(ElIcons as any).Bell" /></button>
          </el-badge>
          <button class="icon-btn"><component :is="(ElIcons as any).FullScreen" /></button>
          <div class="user-chip">
            <div class="avatar">M</div>
            <span class="uname">M. 光影</span>
          </div>
        </div>
      </header>

      <main class="content">
        <RouterView v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  position: relative;
}

// 胶片齿孔装饰
.perforations {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 14px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 10px 0;
  pointer-events: none;
  &.left {
    left: 0;
    background: rgba(0, 0, 0, 0.25);
  }
  span {
    width: 8px;
    height: 12px;
    margin: 0 auto;
    background: rgba(232, 181, 71, 0.18);
    border-radius: 2px;
  }
}

.sidebar {
  width: 232px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #12121c 0%, #0d0d15 100%);
  border-right: 1px solid var(--c-border);
  display: flex;
  flex-direction: column;
  transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 4;
  margin-left: 14px;
  .collapsed & {
    width: 76px;
  }
  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 1px;
    background: linear-gradient(180deg, transparent, rgba(232, 181, 71, 0.3), transparent);
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px;
  border-bottom: 1px solid var(--c-border);
  height: 68px;
  overflow: hidden;
}
.brand-mark {
  flex-shrink: 0;
  filter: drop-shadow(0 0 8px rgba(232, 181, 71, 0.4));
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  white-space: nowrap;
  h1 {
    font-size: 22px;
    font-weight: 700;
  }
  span {
    font-size: 11px;
    color: var(--c-text-tertiary);
    letter-spacing: 0.12em;
  }
}

.nav {
  flex: 1;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  @include scrollbar-dark;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 11px 14px;
  border-radius: 10px;
  color: var(--c-text-secondary);
  position: relative;
  transition: all 0.22s ease;
  white-space: nowrap;
  overflow: hidden;
  .collapsed & {
    justify-content: center;
  }
  .nav-icon {
    font-size: 19px;
    flex-shrink: 0;
    transition: transform 0.22s ease;
  }
  .nav-label {
    font-size: 14px;
    font-weight: 500;
  }
  .nav-glow {
    position: absolute;
    inset: 0;
    border-radius: 10px;
    background: linear-gradient(90deg, rgba(232, 181, 71, 0.16), rgba(232, 181, 71, 0.02));
    opacity: 0;
    transition: opacity 0.22s ease;
    z-index: -1;
  }
  &:hover {
    color: $gold;
    .nav-icon {
      transform: scale(1.12);
    }
    .nav-glow {
      opacity: 1;
    }
  }
  &.active {
    color: $gold-bright;
    font-weight: 600;
    .nav-glow {
      opacity: 1;
    }
    &::before {
      content: '';
      position: absolute;
      left: -14px;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 22px;
      background: $grad-gold;
      border-radius: 0 3px 3px 0;
      box-shadow: 0 0 10px rgba(232, 181, 71, 0.7);
    }
  }
}

.sidebar-foot {
  padding: 14px;
  border-top: 1px solid var(--c-border);
}
.role-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  background: $gold-soft;
  border: 1px solid $gold-line;
  cursor: pointer;
  transition: all 0.2s ease;
  .caret {
    margin-left: auto;
    font-size: 12px;
    color: var(--c-text-tertiary);
  }
  &:hover {
    border-color: $gold;
    box-shadow: $shadow-gold;
  }
}
.role-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(232, 181, 71, 0.1);
  border: 2px solid $gold;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
.role-info {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  strong {
    font-size: 13px;
    color: var(--c-text-primary);
  }
  span {
    font-size: 11px;
    color: var(--c-text-tertiary);
  }
}
.role-switch-item {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid currentColor;
  text-align: center;
  line-height: 16px;
  font-size: 11px;
  margin-right: 6px;
  font-weight: 700;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-right: 14px;
}

.topbar {
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 24px;
  background: rgba(18, 18, 28, 0.7);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--c-border);
}
.collapse-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--c-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--c-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.2s ease;
  &:hover {
    color: $gold;
    border-color: $gold-line;
    background: $gold-soft;
  }
}
.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  .title-deco {
    width: 4px;
    height: 22px;
    background: $grad-gold;
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(232, 181, 71, 0.6);
  }
  h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--c-text-primary);
    letter-spacing: 0.03em;
  }
}
.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}
.quick-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.2;
  padding-right: 16px;
  border-right: 1px solid var(--c-border);
  .qs-label {
    font-size: 11px;
    color: var(--c-text-tertiary);
  }
  .qs-value {
    font-size: 17px;
    font-weight: 600;
    color: $gold-bright;
  }
}
.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--c-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--c-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  transition: all 0.2s ease;
  &:hover {
    color: $gold;
    border-color: $gold-line;
  }
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #c8364f, #8a2335);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
  }
  .uname {
    font-size: 13px;
    color: var(--c-text-primary);
  }
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 22px 24px;
  @include scrollbar-dark;
}

// 过渡
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.page-enter-active {
  animation: fade-up 0.4s ease both;
}
.page-leave-active {
  transition: opacity 0.15s ease;
}
.page-leave-to {
  opacity: 0;
}
</style>
