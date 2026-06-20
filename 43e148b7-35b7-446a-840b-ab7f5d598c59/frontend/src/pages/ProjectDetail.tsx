import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Descriptions,
  Card,
  Tabs,
  Table,
  Progress,
  Tag,
  Space,
  Button,
  Avatar,
  Row,
  Col,
  Statistic,
  Timeline,
} from 'antd'
import { ArrowLeftOutlined, UserOutlined } from '@ant-design/icons'
import { Project, DesignTask, DesignVersion, ChangeRequest, ProjectProfessional, ProfessionType } from '@/types'
import {
  projectTypeMap,
  projectStageMap,
  projectStatusMap,
  projectStatusColorMap,
  taskStatusMap,
  taskStatusColorMap,
  professionMap,
  professionColorMap,
  changeStatusMap,
  changeStatusColorMap,
} from '@/utils/enumMap'
import { mockProjects, mockTasks, mockVersions, mockChanges } from '@/utils/mockData'
import { useAppStore } from '@/store'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentProject = useAppStore((state) => state.currentProject)

  const project = currentProject || mockProjects.find((p) => p.id === Number(id))
  const tasks = mockTasks.filter((t) => t.projectId === Number(id))
  const versions = mockVersions.filter((v) => v.projectId === Number(id))
  const changes = mockChanges.filter((c) => c.projectId === Number(id))

  const professionals: ProjectProfessional[] = [
    { id: 1, projectId: Number(id), profession: 'ARCHITECTURE', professionalLeadId: 4, professionalLeadName: '李建筑', progress: 60 },
    { id: 2, projectId: Number(id), profession: 'STRUCTURE', professionalLeadId: 5, professionalLeadName: '赵结构', progress: 80 },
    { id: 3, projectId: Number(id), profession: 'PLUMBING', professionalLeadId: 6, professionalLeadName: '钱给排水', progress: 10 },
    { id: 4, projectId: Number(id), profession: 'HVAC', professionalLeadId: 7, professionalLeadName: '孙暖通', progress: 0 },
    { id: 5, projectId: Number(id), profession: 'ELECTRICAL', professionalLeadId: 8, professionalLeadName: '周电气', progress: 100 },
  ]

  const taskColumns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '设计阶段',
      dataIndex: 'stage',
      render: (stage: string) => projectStageMap[stage as keyof typeof projectStageMap],
    },
    {
      title: '专业',
      dataIndex: 'profession',
      render: (prof: ProfessionType) => (
        <Tag color={professionColorMap[prof]}>{professionMap[prof]}</Tag>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'assigneeName',
      render: (name: string) =>
        name ? (
          <Space>
            <Avatar size="small" icon={<UserOutlined />} />
            {name}
          </Space>
        ) : (
          <span style={{ color: '#999' }}>未分配</span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={taskStatusColorMap[status as keyof typeof taskStatusColorMap]}>
          {taskStatusMap[status as keyof typeof taskStatusMap]}
        </Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 150,
      render: (progress: number) => <Progress percent={progress} size="small" />,
    },
    {
      title: '计划周期',
      render: (_: any, record: DesignTask) => `${record.plannedStartDate} ~ ${record.plannedEndDate}`,
    },
  ]

  const versionColumns = [
    { title: '版本号', dataIndex: 'versionNo', width: 100 },
    { title: '文件名', dataIndex: 'fileName' },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`,
    },
    { title: '上传人', dataIndex: 'uploadedByName', width: 100 },
    { title: '上传时间', dataIndex: 'createdAt', width: 180 },
    { title: '说明', dataIndex: 'description' },
    {
      title: '状态',
      dataIndex: 'isReleased',
      width: 100,
      render: (released: boolean) =>
        released ? <Tag color="success">已发布</Tag> : <Tag color="default">草稿</Tag>,
    },
  ]

  const changeColumns = [
    { title: '变更编号', dataIndex: 'changeNo', width: 130 },
    { title: '变更标题', dataIndex: 'title' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 160,
      render: (status: string) => (
        <Tag color={changeStatusColorMap[status as keyof typeof changeStatusColorMap]}>
          {changeStatusMap[status as keyof typeof changeStatusMap]}
        </Tag>
      ),
    },
    {
      title: '变更费用',
      dataIndex: 'additionalFee',
      width: 110,
      render: (fee: number) => `¥${fee.toLocaleString()}`,
    },
    { title: '申请人', dataIndex: 'applicantName', width: 100 },
    { title: '申请时间', dataIndex: 'createdAt', width: 180 },
  ]

  if (!project) {
    return (
      <Card>
        <p>项目不存在</p>
        <Button onClick={() => navigate('/projects')}>返回项目列表</Button>
      </Card>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')} style={{ marginBottom: 16 }}>
          返回项目列表
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions title={project.name} bordered size="small" column={2}>
          <Descriptions.Item label="项目编号">{project.projectNo}</Descriptions.Item>
          <Descriptions.Item label="项目类型">{projectTypeMap[project.type]}</Descriptions.Item>
          <Descriptions.Item label="设计阶段">{projectStageMap[project.stage]}</Descriptions.Item>
          <Descriptions.Item label="项目状态">
            <Tag color={projectStatusColorMap[project.status]}>{projectStatusMap[project.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="合同金额">¥{project.contractAmount.toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="整体进度">
            <Progress percent={project.progress} size="small" />
          </Descriptions.Item>
          <Descriptions.Item label="设计周期">
            {project.startDate} ~ {project.endDate}
          </Descriptions.Item>
          <Descriptions.Item label="项目经理">{project.projectManagerName}</Descriptions.Item>
          <Descriptions.Item label="客户">{project.clientName}</Descriptions.Item>
          <Descriptions.Item label="联系方式">
            {project.clientContact} / {project.clientPhone}
          </Descriptions.Item>
          <Descriptions.Item label="项目描述" span={2}>
            {project.description}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {professionals.map((p) => (
          <Col span={24 / professionals.length} key={p.id}>
            <Card size="small">
              <Statistic
                title={
                  <Space>
                    <Tag color={professionColorMap[p.profession]}>{professionMap[p.profession]}</Tag>
                    {p.professionalLeadName}
                  </Space>
                }
                value={p.progress}
                suffix="%"
                valueStyle={{ fontSize: 24 }}
              />
              <Progress percent={p.progress} size="small" />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Tabs
          items={[
            {
              key: 'tasks',
              label: `任务列表 (${tasks.length})`,
              children: (
                <Table
                  columns={taskColumns}
                  dataSource={tasks}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'versions',
              label: `版本记录 (${versions.length})`,
              children: (
                <Table
                  columns={versionColumns}
                  dataSource={versions}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'changes',
              label: `变更记录 (${changes.length})`,
              children: (
                <Table
                  columns={changeColumns}
                  dataSource={changes}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'timeline',
              label: '项目动态',
              children: (
                <div style={{ padding: '24px 0' }}>
                  <Timeline
                    items={[
                      { color: 'green', children: '项目立项成功，开始方案设计 - 2024-01-10 09:00' },
                      { color: 'blue', children: '方案设计阶段任务分配完成 - 2024-01-15 14:00' },
                      { color: 'blue', children: '方案设计校审通过 - 2024-03-20 10:30' },
                      { color: 'blue', children: '进入初步设计阶段 - 2024-03-25 09:00' },
                      { color: 'blue', children: '初步设计校审通过 - 2024-05-10 16:00' },
                      { color: 'processing', children: '施工图设计进行中，当前进度65% - 2024-06-15' },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
