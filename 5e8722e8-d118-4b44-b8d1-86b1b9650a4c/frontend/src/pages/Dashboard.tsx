import { Row, Col, Card, Statistic, Table, Tag, List, Avatar } from 'antd'
import {
  CalendarOutlined,
  UserOutlined,
  DollarOutlined,
  TeamOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import './Dashboard.scss'

const Dashboard: React.FC = () => {
  const stats = [
    { title: '今日预约', value: 36, icon: <CalendarOutlined />, color: '#1890ff', trend: '+12%' },
    { title: '今日接诊', value: 28, icon: <UserOutlined />, color: '#52c41a', trend: '+8%' },
    { title: '本月营收', value: '¥ 128,560', icon: <DollarOutlined />, color: '#faad14', trend: '+15%' },
    { title: '患者总数', value: '8,642', icon: <TeamOutlined />, color: '#722ed1', trend: '+5%' },
  ]

  const appointmentColumns = [
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

  const todayAppointments = [
    { id: 1, patientName: '张三', department: '口腔内科', doctorName: '李医生', timeSlot: '09:00', status: 'confirmed' },
    { id: 2, patientName: '李四', department: '正畸科', doctorName: '王医生', timeSlot: '09:30', status: 'pending' },
    { id: 3, patientName: '王五', department: '种植科', doctorName: '赵医生', timeSlot: '10:00', status: 'confirmed' },
    { id: 4, patientName: '赵六', department: '修复科', doctorName: '钱医生', timeSlot: '10:30', status: 'completed' },
    { id: 5, patientName: '孙七', department: '口腔外科', doctorName: '周医生', timeSlot: '11:00', status: 'confirmed' },
  ]

  const lineChartOption = {
    title: { text: '近7日接诊量趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    },
    yAxis: { type: 'value' },
    series: [
      {
        data: [32, 45, 38, 52, 48, 62, 35],
        type: 'line',
        smooth: true,
        areaStyle: { color: 'rgba(24, 144, 255, 0.2)' },
        lineStyle: { color: '#1890ff' },
        itemStyle: { color: '#1890ff' },
      },
    ],
  }

  const pieChartOption = {
    title: { text: '科室收入占比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: [
          { value: 35, name: '种植科' },
          { value: 25, name: '正畸科' },
          { value: 20, name: '修复科' },
          { value: 12, name: '口腔内科' },
          { value: 8, name: '口腔外科' },
        ],
      },
    ],
  }

  const recentPatients = [
    { id: 1, name: '张三', lastVisit: '2024-01-15', treatment: '根管治疗' },
    { id: 2, name: '李四', lastVisit: '2024-01-14', treatment: '牙齿矫正' },
    { id: 3, name: '王五', lastVisit: '2024-01-14', treatment: '种植牙' },
    { id: 4, name: '赵六', lastVisit: '2024-01-13', treatment: '烤瓷牙' },
  ]

  return (
    <div className="dashboard">
      <Row gutter={[16, 16]}>
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: stat.color }}>
                {stat.icon}
              </div>
              <Statistic title={stat.title} value={stat.value} />
              <div className="stat-trend">
                <ArrowUpOutlined /> {stat.trend} 较上周
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="今日预约" className="content-card">
            <Table
              columns={appointmentColumns}
              dataSource={todayAppointments}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="最近患者" className="content-card">
            <List
              dataSource={recentPatients}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={item.name}
                    description={`${item.treatment} · ${item.lastVisit}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card className="chart-card">
            <ReactECharts option={lineChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="chart-card">
            <ReactECharts option={pieChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
