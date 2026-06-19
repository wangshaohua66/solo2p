/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const worker: any
  export default worker
}
