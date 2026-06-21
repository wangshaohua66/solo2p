import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './assets/styles/global.less';

// 获取根DOM节点
const rootElement = document.getElementById('root');

// 确保根节点存在
if (!rootElement) {
  throw new Error('未找到根DOM节点：#root');
}

// 创建React根实例并启用严格模式渲染
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
