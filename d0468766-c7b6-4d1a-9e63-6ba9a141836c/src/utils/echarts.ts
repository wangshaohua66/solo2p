// ECharts 按需注册 + 暗金主题
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart, RadarChart, GaugeChart, HeatmapChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  GraphicComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapComponent
} from 'echarts/components'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  RadarChart,
  GaugeChart,
  HeatmapChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  GraphicComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapComponent
])

// 暗金主题色板
export const goldPalette = ['#E8B547', '#F0C75E', '#C8364F', '#4ADE80', '#60A5FA', '#A78BFA', '#FBBF24', '#FB7185']

export const darkGoldTheme = {
  backgroundColor: 'transparent',
  textStyle: { color: '#a0a3b1', fontFamily: 'Noto Sans SC, sans-serif' },
  title: { textStyle: { color: '#F5F5F7' } },
  legend: { textStyle: { color: '#a0a3b1' } },
  tooltip: {
    backgroundColor: 'rgba(20,20,30,0.95)',
    borderColor: 'rgba(232,181,71,0.4)',
    borderWidth: 1,
    textStyle: { color: '#F5F5F7' },
    extraCssText: 'backdrop-filter: blur(8px); box-shadow: 0 8px 30px rgba(0,0,0,0.5);'
  },
  grid: { top: 40, right: 20, bottom: 40, left: 50 }
}
