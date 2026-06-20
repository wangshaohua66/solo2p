import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ProjectSidebar } from '@/components/layout/ProjectSidebar';
import { ToolPanel } from '@/components/layout/ToolPanel';
import { WorkflowDesigner } from '@/components/layout/WorkflowDesigner';
import { TabContainer } from '@/components/common/TabContainer';
import { ToastNotification } from '@/components/common/ToastNotification';
import { ResizablePanel } from '@/components/common/ResizablePanel';
import { SequenceViewer } from '@/components/sequence-viewer/SequenceViewer';
import { MutationPanel } from '@/components/mutation-panel/MutationPanel';
import { PrimerDesigner } from '@/components/primer-designer/PrimerDesigner';
import { QualityChart } from '@/components/quality-chart/QualityChart';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { ActiveTab } from '@/types';
import { Dna, AlertTriangle, FlaskConical, Activity } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const activeTab = useAnalysisStore((s) => s.activeTab);
  const setActiveTab = useAnalysisStore((s) => s.setActiveTab);
  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const currentProject = useAnalysisStore.getState;

  const [showWorkflow, setShowWorkflow] = useState(false);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setShowLeft(w >= 768);
      setShowRight(w >= 1024);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const tabs = [
    {
      key: 'sequence' as ActiveTab,
      label: '序列可视化',
      icon: Dna,
      badge: currentSequence ? currentSequence.length.toLocaleString() + ' bp' : undefined,
    },
    {
      key: 'mutation' as ActiveTab,
      label: '突变分析',
      icon: AlertTriangle,
      badge: undefined,
    },
    {
      key: 'primer' as ActiveTab,
      label: '引物设计',
      icon: FlaskConical,
      badge: undefined,
    },
    {
      key: 'quality' as ActiveTab,
      label: '质量评估',
      icon: Activity,
      badge: undefined,
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'sequence':
        return <SequenceViewer />;
      case 'mutation':
        return <MutationPanel />;
      case 'primer':
        return <PrimerDesigner />;
      case 'quality':
        return <QualityChart />;
      default:
        return <SequenceViewer />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-bio-bg text-bio-text overflow-hidden">
      <header className="h-11 flex items-center justify-between px-4 border-b border-bio-border bg-bio-bg/80 backdrop-blur-sm flex-shrink-0 z-20">
        <div className="flex items-center gap-2">
          {!showLeft && (
            <button
              onClick={() => setShowLeft(true)}
              className="p-1.5 rounded hover:bg-bio-panel text-bio-text-secondary hover:text-bio-text"
              title="显示项目栏"
            >
              <Dna className="w-4 h-4" />
            </button>
          )}
          <div className="text-xs text-bio-text-secondary">
            <span className="text-bio-text font-medium">GeneWorkstation</span>
            <span className="mx-2 text-bio-border">|</span>
            <span>临床基因检测分析工作站</span>
            {currentSequence && (
              <>
                <span className="mx-2 text-bio-border">|</span>
                <span className="text-bio-blue font-mono">{currentSequence.name}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowLeft(!showLeft)}
            className={`p-1.5 rounded hover:bg-bio-panel transition-colors ${showLeft ? 'text-bio-blue' : 'text-bio-text-secondary'}`}
            title="切换项目栏"
          >
            <Dna className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowRight(!showRight)}
            className={`p-1.5 rounded hover:bg-bio-panel transition-colors ${showRight ? 'text-bio-blue' : 'text-bio-text-secondary'}`}
            title="切换工具面板"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {showLeft && (
          <ResizablePanel
            direction="right"
            defaultSize={280}
            minSize={220}
            maxSize={420}
            className="flex-shrink-0"
            onCollapse={() => setShowLeft(false)}
          >
            <ProjectSidebar onOpenWorkflow={() => setShowWorkflow(true)} />
          </ResizablePanel>
        )}

        <main className="flex-1 flex flex-col min-w-0 bg-bio-bg">
          <TabContainer
            tabs={tabs}
            activeTab={activeTab}
            onChange={(k) => setActiveTab(k as ActiveTab)}
          />
          <div className="flex-1 overflow-hidden min-h-0 relative">
            <div
              key={activeTab}
              className="absolute inset-0 animate-fade-in"
            >
              {renderContent()}
            </div>
          </div>
        </main>

        {showRight && (
          <ResizablePanel
            direction="left"
            defaultSize={300}
            minSize={260}
            maxSize={480}
            className="flex-shrink-0"
            onCollapse={() => setShowRight(false)}
          >
            <ToolPanel />
          </ResizablePanel>
        )}
      </div>

      <WorkflowDesigner open={showWorkflow} onClose={() => setShowWorkflow(false)} />
      <ToastNotification />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: antdTheme.darkAlgorithm,
          token: {
            colorPrimary: '#58a6ff',
            colorBgContainer: '#161b22',
            colorBgElevated: '#161b22',
            colorBorder: '#30363d',
            colorText: '#c9d1d9',
            colorTextSecondary: '#8b949e',
            borderRadius: 6,
            colorInfo: '#58a6ff',
            colorSuccess: '#3fb950',
            colorWarning: '#d29922',
            colorError: '#f85149',
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontFamilyCode: '"JetBrains Mono", "SF Mono", Monaco, "Courier New", monospace',
          },
          components: {
            Tabs: {
              itemColor: '#8b949e',
              itemSelectedColor: '#58a6ff',
              itemHoverColor: '#c9d1d9',
              inkBarColor: '#58a6ff',
            },
            Button: {
              defaultBg: '#21262d',
              defaultBorderColor: '#30363d',
              defaultColor: '#c9d1d9',
              primaryColor: '#ffffff',
            },
            Input: {
              colorBgContainer: '#0d1117',
              activeBorderColor: '#58a6ff',
              hoverBorderColor: '#30363d',
            },
            Modal: {
              contentBg: '#161b22',
              headerBg: '#161b22',
            },
            Empty: {
              colorTextDescription: '#8b949e',
            },
          },
        }}
      >
        <AppContent />
      </ConfigProvider>
    </QueryClientProvider>
  );
}
