import { ref, onMounted, onUnmounted, nextTick, watch, type Ref, type ComputedRef } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';

export function useECharts(
  options: Ref<EChartsOption> | ComputedRef<EChartsOption>,
  theme?: string | object
) {
  const chartRef = ref<HTMLDivElement | null>(null);
  const chartInstance = ref<ECharts | null>(null);
  const isReady = ref(false);

  let resizeObserver: ResizeObserver | null = null;
  let initRetryCount = 0;
  const maxInitRetries = 5;

  const ensureValidOptions = (opts: EChartsOption): EChartsOption => {
    const validOpts = { ...opts } as any;

    if (validOpts.series && Array.isArray(validOpts.series)) {
      validOpts.series = validOpts.series.filter((s: any) => s && s.type);
    }

    if (!validOpts.series || !Array.isArray(validOpts.series)) {
      validOpts.series = [];
    }

    return validOpts;
  };

  const hasValidDimensions = (): boolean => {
    if (!chartRef.value) return false;
    const { clientWidth, clientHeight } = chartRef.value;
    return clientWidth > 0 && clientHeight > 0;
  };

  const initChart = () => {
    if (!chartRef.value) return;

    if (!hasValidDimensions()) {
      if (initRetryCount < maxInitRetries) {
        initRetryCount++;
        setTimeout(() => initChart(), 100);
      }
      return;
    }

    initRetryCount = 0;

    if (chartInstance.value) {
      try {
        chartInstance.value.dispose();
      } catch (e) {
        // ignore dispose errors
      }
      chartInstance.value = null;
    }

    try {
      chartInstance.value = echarts.init(chartRef.value, theme || 'dark', {
        renderer: 'canvas',
      });

      if (options?.value) {
        const validOpts = ensureValidOptions(options.value);
        chartInstance.value.setOption(validOpts, false);
      }

      isReady.value = true;
    } catch (e) {
      console.error('ECharts init failed:', e);
    }
  };

  const updateOption = (newOptions: EChartsOption, notMerge = false) => {
    if (chartInstance.value && isReady.value) {
      try {
        const validOpts = ensureValidOptions(newOptions);
        chartInstance.value.setOption(validOpts, notMerge);
      } catch (e) {
        console.error('ECharts setOption failed:', e);
      }
    }
  };

  const resize = () => {
    if (chartInstance.value && isReady.value) {
      try {
        chartInstance.value.resize();
      } catch (e) {
        console.error('ECharts resize failed:', e);
      }
    }
  };

  const handleResize = () => {
    resize();
  };

  onMounted(() => {
    nextTick(() => {
      setTimeout(() => initChart(), 50);

      if (chartRef.value) {
        resizeObserver = new ResizeObserver(() => {
          if (!hasValidDimensions()) return;
          if (!chartInstance.value) {
            initChart();
          } else {
            handleResize();
          }
        });
        resizeObserver.observe(chartRef.value);
      }

      window.addEventListener('resize', handleResize);
    });
  });

  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    window.removeEventListener('resize', handleResize);

    if (chartInstance.value) {
      try {
        chartInstance.value.dispose();
      } catch (e) {
        // ignore
      }
      chartInstance.value = null;
    }

    isReady.value = false;
  });

  if (options) {
    watch(
      options,
      (newOptions) => {
        if (newOptions) {
          updateOption(newOptions, false);
        }
      },
      { deep: true }
    );
  }

  return {
    chartRef,
    chartInstance,
    isReady,
    initChart,
    updateOption,
    resize,
  };
}
