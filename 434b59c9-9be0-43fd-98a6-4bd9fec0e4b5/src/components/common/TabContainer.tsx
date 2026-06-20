import { ReactNode, useState } from 'react';
import type { ActiveTab } from '@/types';

interface TabItem {
  key: ActiveTab;
  label: string;
  icon?: React.ComponentType<any> | ReactNode;
  content?: ReactNode;
  badge?: string;
}

interface TabContainerProps {
  tabs: TabItem[];
  activeTab: ActiveTab;
  onChange: (key: ActiveTab) => void;
  className?: string;
}

export function TabContainer({ tabs, activeTab, onChange, className = '' }: TabContainerProps) {
  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center border-b border-bio-border px-2 bg-bio-bg/50">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium
                border-b-2 -mb-px transition-all duration-200
                ${isActive
                  ? 'border-bio-blue text-bio-blue'
                  : 'border-transparent text-bio-text-secondary hover:text-bio-text hover:bg-bio-panel/30'
                }
              `}
            >
              {tab.icon && (
                <span className="w-4 h-4 flex items-center justify-center">
                  {typeof tab.icon === 'function'
                    ? (() => {
                        const IconCmp = tab.icon as React.ComponentType<any>;
                        return <IconCmp />;
                      })()
                    : tab.icon}
                </span>
              )}
              {tab.label}
              {tab.badge && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-bio-blue/15 text-bio-blue rounded">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden relative">
        {tabs.filter(t => t.content).map((tab) => (
          <div
            key={tab.key}
            className={`
              absolute inset-0 overflow-auto
              transition-all duration-200
              ${tab.key === activeTab
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-1 pointer-events-none'
              }
            `}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
