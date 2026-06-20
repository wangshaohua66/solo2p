import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import ProjectList from '@/views/ProjectList.vue';
import AppLayout from '@/components/layout/AppLayout.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/projects' },
  { path: '/projects', component: ProjectList, name: 'project-list' },
  {
    path: '/projects/:projectId',
    component: AppLayout,
    redirect: to => `/projects/${to.params.projectId}/sprites`,
    children: [
      { path: 'sprites', component: () => import('@/views/SpriteEditor.vue'), name: 'sprite-editor' },
      { path: 'animations', component: () => import('@/views/AnimationEditor.vue'), name: 'animation-editor' },
      { path: 'tilemaps', component: () => import('@/views/TilemapEditor.vue'), name: 'tilemap-editor' },
      { path: 'audio', component: () => import('@/views/AudioManager.vue'), name: 'audio-manager' }
    ]
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
