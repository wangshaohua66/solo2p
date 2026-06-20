/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@vue-flow/core' {
  export * from '@vue-flow/core/dist/types'
}

declare module '@vue-flow/background' {
  export * from '@vue-flow/background/dist/types'
}

declare module '@vue-flow/controls' {
  export * from '@vue-flow/controls/dist/types'
}

declare module '@vue-flow/minimap' {
  export * from '@vue-flow/minimap/dist/types'
}
