import React from 'react'
import { Card } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

interface ChartCardProps {
  title?: string
  option: EChartsOption
  height?: number
  loading?: boolean
  extra?: React.ReactNode
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  option,
  height = 300,
  loading = false,
  extra,
}) => {
  return (
    <Card title={title} extra={extra} className="dashboard-chart-card" loading={loading}>
      <ReactECharts option={option} style={{ height }} opts={{ renderer: 'canvas' }} />
    </Card>
  )
}

export default ChartCard
