import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logOperation } from '@/db/operations/logOperations';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    void logOperation('error', 'system', null, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          backgroundColor: 'var(--color-bg-primary)',
        }}
      >
        <div
          style={{
            maxWidth: '560px',
            width: '100%',
            padding: '32px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={24} style={{ color: 'var(--color-error)' }} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                出现错误
              </h2>
              <p
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                组件渲染过程中发生异常
              </p>
            </div>
          </div>

          {this.state.error && (
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-tertiary)',
                marginBottom: '20px',
                maxHeight: '200px',
                overflow: 'auto',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-family-display)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-error)',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {this.state.error.message}
              </p>
              {this.state.error.stack && (
                <p
                  style={{
                    fontFamily: 'var(--font-family-display)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-muted)',
                    marginTop: '8px',
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {this.state.error.stack}
                </p>
              )}
            </div>
          )}

          <button
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-accent-primary)',
              color: '#fff',
              fontSize: 'var(--font-size-base)',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              transition: 'all var(--transition-base)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
            }}
          >
            <RefreshCw size={18} />
            重试
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
