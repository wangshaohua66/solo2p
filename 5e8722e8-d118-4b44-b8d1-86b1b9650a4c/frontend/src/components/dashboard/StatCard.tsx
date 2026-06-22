import { Card, Statistic } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import './StatCard.scss'

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  color?: string
  trend?: string
  trendType?: 'up' | 'down'
  trendText?: string
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color = '#1890ff',
  trend,
  trendType = 'up',
  trendText = '较上周',
}) => {
  return (
    <Card className="stat-card">
      <div className="stat-icon" style={{ backgroundColor: color }}>
        {icon}
      </div>
      <Statistic title={title} value={value} />
      {trend && (
        <div className={`stat-trend ${trendType}`}>
          {trendType === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          <span className="trend-value">{trend}</span>
          <span className="trend-text">{trendText}</span>
        </div>
      )}
    </Card>
  )
}

export default StatCard
