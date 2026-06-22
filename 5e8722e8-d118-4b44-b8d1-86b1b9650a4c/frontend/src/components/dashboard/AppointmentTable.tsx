import { Card, Table, Tag } from 'antd'

interface AppointmentItem {
  id: number
  patientName: string
  department: string
  doctorName: string
  timeSlot: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
}

interface AppointmentTableProps {
  title?: string
  data?: AppointmentItem[]
  loading?: boolean
}

const AppointmentTable: React.FC<AppointmentTableProps> = ({
  title = '今日预约',
  data = [],
  loading = false,
}) => {
  const columns = [
    { title: '患者姓名', dataIndex: 'patientName', key: 'patientName' },
    { title: '科室', dataIndex: 'department', key: 'department' },
    { title: '医生', dataIndex: 'doctorName', key: 'doctorName' },
    { title: '时段', dataIndex: 'timeSlot', key: 'timeSlot' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'orange',
          confirmed: 'green',
          completed: 'blue',
          cancelled: 'red',
        }
        const textMap: Record<string, string> = {
          pending: '待确认',
          confirmed: '已确认',
          completed: '已完成',
          cancelled: '已取消',
        }
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>
      },
    },
  ]

  return (
    <Card title={title} className="dashboard-appointment-table">
      <Table
        columns={columns}
        dataSource={data}
        pagination={false}
        size="small"
        loading={loading}
        rowKey="id"
      />
    </Card>
  )
}

export default AppointmentTable
