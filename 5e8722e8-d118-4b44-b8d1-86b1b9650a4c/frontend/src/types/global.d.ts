// 全局类型声明
declare module '*.scss' {
  const classes: { [key: string]: string }
  export default classes
}

declare module 'echarts-for-react' {
  import React from 'react'
  import ECharts from 'echarts'

  interface ReactEChartsProps {
    option: any
    style?: React.CSSProperties
    className?: string
    theme?: string | object
    opts?: {
      devicePixelRatio?: number
      renderer?: string
      width?: number | string
      height?: number | string
    }
    onChartReady?: (chart: ECharts.ECharts) => void
  }

  const ReactECharts: React.ComponentType<ReactEChartsProps>
  export default ReactECharts
}
