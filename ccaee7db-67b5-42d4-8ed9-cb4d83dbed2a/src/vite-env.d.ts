/// <reference types="vite/client" />

// Vite环境类型声明文件
// 此文件用于声明Vite客户端相关的类型，以及自定义的环境变量类型

// CSS Modules (LESS) 类型声明
declare module '*.module.less' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// 自定义ImportMetaEnv接口，用于类型化的import.meta.env
interface ImportMetaEnv {
  // 应用标题
  readonly VITE_APP_TITLE: string;
  // API基础地址
  readonly VITE_API_BASE_URL: string;
  // Socket.IO服务地址
  readonly VITE_SOCKET_URL: string;
  // 运行环境
  readonly VITE_APP_ENV: 'development' | 'production' | 'test';
}

// 扩展ImportMeta接口
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
