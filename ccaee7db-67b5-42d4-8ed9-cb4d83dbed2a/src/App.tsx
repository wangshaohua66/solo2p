import React, { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Result, Button } from 'antd';
import { router } from '@/router';
import { useMonitorStore } from '@/stores/monitorStore';

// 错误边界组件的Props接口
interface ErrorBoundaryProps {
  children: ReactNode;
}

// 错误边界组件的State接口
interface ErrorBoundaryState {
  hasError: boolean;       // 是否发生错误
  error: Error | null;     // 错误对象
  errorInfo: ErrorInfo | null; // 错误详细信息
}

// 错误边界类组件：捕获子组件渲染过程中的错误
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // 初始化状态
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  // 静态方法：从错误对象派生状态
  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  // 捕获错误后的回调，可用于上报错误日志
  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      errorInfo,
    });
    // 此处可添加错误上报逻辑（如发送到监控服务）
    console.error('应用渲染错误:', error, errorInfo);
  }

  // 处理页面刷新操作
  private handleRefresh = (): void => {
    window.location.reload();
  };

  // 渲染方法
  public render(): ReactNode {
    if (this.state.hasError) {
      // 降级UI：使用antd的Result组件展示错误信息
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            backgroundColor: '#f5f5f5',
          }}
        >
          <Result
            status="error"
            title="页面出现异常"
            subTitle={this.state.error?.message || '发生了未知错误，请刷新页面后重试。'}
            extra={
              <Button type="primary" onClick={this.handleRefresh}>
                刷新页面
              </Button>
            }
          >
            {this.state.errorInfo && (
              <details
                style={{
                  whiteSpace: 'pre-wrap',
                  maxWidth: 600,
                  textAlign: 'left',
                  margin: '0 auto',
                }}
              >
                <summary>错误详情</summary>
                <p style={{ color: '#999', fontSize: 12 }}>
                  {this.state.errorInfo.componentStack}
                </p>
              </details>
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

// 应用初始化组件
const AppInitializer: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initializeMockData = useMonitorStore((state) => state.initializeMockData);
  const channels = useMonitorStore((state) => state.channels);

  // 应用启动时初始化Mock数据
  useEffect(() => {
    if (Object.keys(channels).length === 0) {
      initializeMockData();
    }
  }, [initializeMockData, channels]);

  return <>{children}</>;
};

// 应用根组件
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppInitializer>
        <RouterProvider router={router} />
      </AppInitializer>
    </ErrorBoundary>
  );
};

export default App;
