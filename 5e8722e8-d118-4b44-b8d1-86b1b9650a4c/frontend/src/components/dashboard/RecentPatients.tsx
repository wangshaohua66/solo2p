import { Card, List, Avatar } from 'antd'
import { UserOutlined } from '@ant-design/icons'

interface PatientItem {
  id: number
  name: string
  lastVisit: string
  treatment: string
  avatar?: string
}

interface RecentPatientsProps {
  title?: string
  data?: PatientItem[]
  loading?: boolean
}

const RecentPatients: React.FC<RecentPatientsProps> = ({
  title = '最近患者',
  data = [],
  loading = false,
}) => {
  return (
    <Card title={title} className="dashboard-recent-patients">
      <List
        dataSource={data}
        loading={loading}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
            avatar={<Avatar src={item.avatar} icon={!item.avatar && <UserOutlined />} />
            title={item.name}
            description={`${item.treatment} · ${item.lastVisit}`}
          />
        </List.Item>
      )}
    </Card>
  )
}

export default RecentPatients
