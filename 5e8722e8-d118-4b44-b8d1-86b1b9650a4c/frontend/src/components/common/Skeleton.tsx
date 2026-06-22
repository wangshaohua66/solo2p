import React from 'react'
import { Skeleton, Card, List } from 'antd'
import './Skeleton.scss'

interface TableSkeletonProps {
  rows?: number
  columns?: number
  loading?: boolean
  children?: React.ReactNode
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 6,
  columns = 5,
  loading = true,
  children,
}) => {
  if (!loading) {
    return <>{children}</>
  }

  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="skeleton-th">
            <Skeleton.Input active size="small" style={{ width: '80%' }} />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="skeleton-td">
              <Skeleton.Input active size="small" style={{ width: colIndex === 0 ? '60%' : '80%' }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

interface ListSkeletonProps {
  count?: number
  avatar?: boolean
  loading?: boolean
  children?: React.ReactNode
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  count = 5,
  avatar = true,
  loading = true,
  children,
}) => {
  if (!loading) {
    return <>{children}</>
  }

  return (
    <div className="skeleton-list">
      <List
        dataSource={Array.from({ length: count })}
        renderItem={() => (
          <List.Item>
            <Skeleton
              active
              avatar={avatar}
              paragraph={{ rows: 2, width: ['80%', '60%'] }}
            />
          </List.Item>
        )}
      />
    </div>
  )
}

interface CardSkeletonProps {
  count?: number
  loading?: boolean
  children?: React.ReactNode
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  count = 4,
  loading = true,
  children,
}) => {
  if (!loading) {
    return <>{children}</>
  }

  return (
    <div className="skeleton-cards">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="skeleton-card">
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
      ))}
    </div>
  )
}

interface ChartSkeletonProps {
  loading?: boolean
  height?: number
  children?: React.ReactNode
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({
  loading = true,
  height = 300,
  children,
}) => {
  if (!loading) {
    return <>{children}</>
  }

  return (
    <div className="skeleton-chart" style={{ height }}>
      <Skeleton active paragraph={{ rows: 1 }} />
      <div className="skeleton-chart-area">
        <Skeleton.Button active size="large" style={{ width: '100%', height: height - 60 }} />
      </div>
    </div>
  )
}

interface PageSkeletonProps {
  loading?: boolean
  children?: React.ReactNode
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  loading = true,
  children,
}) => {
  if (!loading) {
    return <>{children}</>
  }

  return (
    <div className="skeleton-page">
      <Card className="skeleton-main-card">
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    </div>
  )
}

const Skeletons = {
  Table: TableSkeleton,
  List: ListSkeleton,
  Card: CardSkeleton,
  Chart: ChartSkeleton,
  Page: PageSkeleton,
}

export default Skeletons
