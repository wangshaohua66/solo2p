import { useState, useEffect, useCallback } from "react";

export interface BreakpointState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  singleTrackMode: boolean;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function useBreakpoint(): BreakpointState {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  return {
    isMobile,
    isTablet,
    isDesktop,
    singleTrackMode: isMobile,
  };
}

export function useResponsivePanels(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  singleTrackMode: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
} {
  const { isMobile, isTablet, isDesktop, singleTrackMode } = useBreakpoint();
  const leftPanelOpen = useEditorStoreLeftPanel();
  const rightPanelOpen = useEditorStoreRightPanel();
  const setLeftPanelOpen = useEditorStoreSetLeft();
  const setRightPanelOpen = useEditorStoreSetRight();

  const toggleLeftPanel = useCallback(() => {
    setLeftPanelOpen(!leftPanelOpen);
  }, [leftPanelOpen, setLeftPanelOpen]);

  const toggleRightPanel = useCallback(() => {
    setRightPanelOpen(!rightPanelOpen);
  }, [rightPanelOpen, setRightPanelOpen]);

  return {
    isMobile,
    isTablet,
    isDesktop,
    singleTrackMode,
    toggleLeftPanel,
    toggleRightPanel,
    leftPanelOpen,
    rightPanelOpen,
  };
}

import { useEditorStore } from "@/stores/editorStore";

function useEditorStoreLeftPanel(): boolean {
  return useEditorStore((s) => s.leftPanelOpen);
}
function useEditorStoreRightPanel(): boolean {
  return useEditorStore((s) => s.rightPanelOpen);
}
function useEditorStoreSetLeft(): (v: boolean) => void {
  return useEditorStore((s) => s.setLeftPanelOpen);
}
function useEditorStoreSetRight(): (v: boolean) => void {
  return useEditorStore((s) => s.setRightPanelOpen);
}
