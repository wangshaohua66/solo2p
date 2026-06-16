/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AMAP_KEY: string;
  readonly VITE_AMAP_SECURITY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
