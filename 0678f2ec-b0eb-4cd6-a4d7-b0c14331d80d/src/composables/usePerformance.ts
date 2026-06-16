import { ref, onMounted, onUnmounted } from 'vue';
import { useApronStore } from '@/stores/apron';

export function usePerformance() {
  const store = useApronStore();
  const isMonitoring = ref(false);
  let rafId: number | null = null;
  let lastTime = performance.now();
  let frameCount = 0;
  let fpsUpdateTimer: ReturnType<typeof setInterval> | null = null;

  const collectNavigationTiming = () => {
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (nav) {
        store.updatePerformance({
          firstPaint: Math.round(nav.loadEventStart - nav.fetchStart),
          firstContentfulPaint: Math.round(nav.domContentLoadedEventEnd - nav.fetchStart),
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.fetchStart),
          loadEvent: Math.round(nav.loadEventEnd - nav.fetchStart),
        });
      }

      const paint = performance.getEntriesByType('paint');
      paint.forEach(entry => {
        if (entry.name === 'first-paint') {
          store.updatePerformance({ firstPaint: Math.round(entry.startTime) });
        }
        if (entry.name === 'first-contentful-paint') {
          store.updatePerformance({ firstContentfulPaint: Math.round(entry.startTime) });
        }
      });
    } catch (e) {
      console.warn('Performance timing not available:', e);
    }
  };

  const collectMemoryInfo = () => {
    try {
      const mem = (performance as any).memory;
      if (mem) {
        const usedMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
        const totalMB = Math.round(mem.totalJSHeapSize / (1024 * 1024));
        const limitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
        store.updatePerformance({
          memoryUsed: usedMB,
          memoryTotal: totalMB,
          memoryLimit: limitMB,
        });
      }
    } catch (e) {
      console.warn('Memory info not available:', e);
    }
  };

  const measureFPS = () => {
    frameCount++;
    const now = performance.now();
    const delta = now - lastTime;

    if (delta >= 1000) {
      const fps = Math.round((frameCount * 1000) / delta);
      store.updatePerformance({ fps });
      frameCount = 0;
      lastTime = now;
    }

    rafId = requestAnimationFrame(measureFPS);
  };

  const trackInteraction = (name: string) => {
    const startTime = performance.now();
    return {
      end: () => {
        const duration = Math.round(performance.now() - startTime);
        store.addInteractionMetric({
          name,
          startTime: Math.round(startTime),
          duration,
        });
      },
    };
  };

  const wrapWithPerf = <T extends (...args: any[]) => any>(name: string, fn: T) => {
    return ((...args: Parameters<T>) => {
      const tracker = trackInteraction(name);
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result.finally(() => tracker.end());
        }
        tracker.end();
        return result;
      } catch (e) {
        tracker.end();
        throw e;
      }
    }) as T;
  };

  const startMonitoring = () => {
    if (isMonitoring.value) return;
    isMonitoring.value = true;

    collectNavigationTiming();
    collectMemoryInfo();

    rafId = requestAnimationFrame(measureFPS);

    fpsUpdateTimer = setInterval(() => {
      collectMemoryInfo();
      store.addPerformanceHistoryPoint({
        fps: store.performance.fps,
        memoryUsed: store.performance.memoryUsed,
        responseTime: store.performance.lastResponseTime,
      });
    }, 1000);
  };

  const stopMonitoring = () => {
    isMonitoring.value = false;

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (fpsUpdateTimer !== null) {
      clearInterval(fpsUpdateTimer);
      fpsUpdateTimer = null;
    }
  };

  onMounted(() => {
    if (typeof performance !== 'undefined') {
      startMonitoring();
    }
  });

  onUnmounted(() => {
    stopMonitoring();
  });

  return {
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    trackInteraction,
    wrapWithPerf,
    collectMemoryInfo,
    collectNavigationTiming,
  };
}
