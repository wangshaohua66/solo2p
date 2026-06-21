import { useMemo } from 'react';
import { Card, Typography, Table, Tag, List, Row, Col, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Network,
  Building2,
  AlertTriangle,
  Zap,
  Lightbulb,
  Settings2,
  ArrowRight,
} from 'lucide-react';
import EquipmentTree from './EquipmentTree';
import TopologyCanvas from './TopologyCanvas';
import { useEquipmentSelector } from '@/store/equipmentStore';
import {
  calculateOutageScope,
  suggestLoadTransfer,
} from '@/utils/topologyAnalyzer';
import type { Substation, OutageLevel, TransferSuggestion } from '@/types';

const { Title, Text, Paragraph } = Typography;

interface AffectedStation extends Substation {
  outageLevel: OutageLevel;
}

const priorityTagColor: Record<TransferSuggestion['priority'], string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
};

const priorityTagText: Record<TransferSuggestion['priority'], string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
};

const outageLevelTagColor: Record<OutageLevel, string> = {
  level1: 'red',
  level2: 'orange',
  level3: 'default',
};

const outageLevelText: Record<OutageLevel, string> = {
  level1: '一级停电',
  level2: '二级停电',
  level3: '三级停电',
};

const TopologyViewer = () => {
  const substations = useEquipmentSelector((s) => s.substations);
  const lines = useEquipmentSelector((s) => s.lines);
  const equipments = useEquipmentSelector((s) => s.equipments);
  const adjacencyMap = useEquipmentSelector((s) => s.adjacencyMap);
  const selectedEquipmentId = useEquipmentSelector((s) => s.selectedEquipmentId);

  const outageScope = useMemo(() => {
    if (!selectedEquipmentId) return null;
    return calculateOutageScope(
      selectedEquipmentId,
      adjacencyMap,
      substations,
      equipments,
      lines
    );
  }, [selectedEquipmentId, adjacencyMap, substations, equipments, lines]);

  const kpiData = useMemo(() => {
    if (!outageScope) {
      return { level1: 0, level2: 0, level3: 0, lostCapacity: 0 };
    }

    let level1 = 0;
    let level2 = 0;
    let level3 = 0;

    outageScope.affectedStations.forEach((stationId) => {
      const station = substations.find((s) => s.id === stationId);
      if (station) {
        if (outageScope.level1Nodes.has(stationId)) {
          level1++;
        } else if (outageScope.level2Nodes.has(stationId)) {
          level2++;
        } else {
          level3++;
        }
      }
    });

    return {
      level1,
      level2,
      level3,
      lostCapacity: outageScope.lostCapacity,
    };
  }, [outageScope, substations]);

  const affectedStations: AffectedStation[] = useMemo(() => {
    if (!outageScope || outageScope.affectedStations.length === 0) {
      return [];
    }

    return outageScope.affectedStations
      .map((stationId) => {
        const station = substations.find((s) => s.id === stationId);
        if (!station) return null;
        let outageLevel: OutageLevel = 'level3';
        if (outageScope.level1Nodes.has(stationId)) {
          outageLevel = 'level1';
        } else if (outageScope.level2Nodes.has(stationId)) {
          outageLevel = 'level2';
        }
        return {
          ...station,
          outageLevel,
        };
      })
      .filter(Boolean) as AffectedStation[];
  }, [outageScope, substations]);

  const transferSuggestions: TransferSuggestion[] = useMemo(() => {
    if (!outageScope || outageScope.affectedStations.length === 0) {
      return [];
    }
    return suggestLoadTransfer(
      outageScope.affectedStations,
      adjacencyMap,
      substations,
      lines,
      3
    );
  }, [outageScope, adjacencyMap, substations, lines]);

  const tableColumns: ColumnsType<AffectedStation> = [
    {
      title: '站名',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string) => (
        <span className="text-sm text-gray-700 font-medium">{text}</span>
      ),
    },
    {
      title: '电压等级',
      dataIndex: 'voltageLevel',
      key: 'voltageLevel',
      width: 90,
      render: (level: string) => (
        <Tag color="dispatch" className="!mr-0">
          {level}
        </Tag>
      ),
    },
    {
      title: '容量(MVA)',
      dataIndex: 'capacity',
      key: 'capacity',
      width: 90,
      align: 'right',
      render: (val: number) => (
        <span className="text-sm text-gray-600 font-mono">{val}</span>
      ),
    },
    {
      title: '停电级别',
      dataIndex: 'outageLevel',
      key: 'outageLevel',
      width: 90,
      render: (level: OutageLevel) => (
        <Tag color={outageLevelTagColor[level]} className="!mr-0">
          {outageLevelText[level]}
        </Tag>
      ),
    },
  ];

  return (
    <Card
      className="!shadow-sm"
      title={
        <span className="text-base font-semibold text-slate-800 inline-flex items-center gap-2">
          <Network size={16} className="text-dispatch-600" />
          电网拓扑视图
        </span>
      }
    >
      <div className="flex flex-row w-full min-w-0">
        <div
          className="flex flex-col border border-gray-200 rounded-l-lg bg-white overflow-hidden"
          style={{ width: '280px', minWidth: '280px' }}
        >
          <div
            className="flex items-center px-4 border-b border-gray-100 bg-gradient-to-r from-dispatch-50 to-white"
            style={{ height: '40px' }}
          >
            <Building2 size={16} className="text-dispatch-600 mr-2" />
            <span className="text-sm font-semibold text-dispatch-800">
              设备目录
            </span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <EquipmentTree />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 mx-2">
          <div
            className="h-[620px] border border-gray-200 rounded-lg overflow-hidden bg-dispatch-50/30"
            style={{ height: '620px' }}
          >
            <TopologyCanvas />
          </div>
        </div>

        <div
          className="flex flex-col border border-gray-200 rounded-r-lg bg-white overflow-hidden gap-3 p-3"
          style={{ width: '320px', minWidth: '320px' }}
        >
          {!selectedEquipmentId ? (
            <div className="flex-1 flex items-center justify-center">
              <Empty
                description={
                  <span className="text-sm text-gray-500">
                    请在左侧选择设备查看影响分析
                  </span>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <>
              <div className="w-full">
                <Title
                  level={5}
                  className="!text-sm !mb-3 !text-dispatch-800 flex items-center gap-1.5"
                >
                  <AlertTriangle size={14} className="text-amber-500" />
                  停电影响分析
                </Title>
                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Card
                      size="small"
                      className="!rounded-md hover:!shadow-md transition-shadow"
                      styles={{ body: { padding: '10px 12px' } }}
                    >
                      <div className="flex flex-col">
                        <Text type="secondary" className="!text-xs">
                          一级停电
                        </Text>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-bold text-red-600">
                            {kpiData.level1}
                          </span>
                          <span className="text-xs text-gray-400">座</span>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card
                      size="small"
                      className="!rounded-md hover:!shadow-md transition-shadow"
                      styles={{ body: { padding: '10px 12px' } }}
                    >
                      <div className="flex flex-col">
                        <Text type="secondary" className="!text-xs">
                          二级停电
                        </Text>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-bold text-orange-600">
                            {kpiData.level2}
                          </span>
                          <span className="text-xs text-gray-400">座</span>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card
                      size="small"
                      className="!rounded-md hover:!shadow-md transition-shadow"
                      styles={{ body: { padding: '10px 12px' } }}
                    >
                      <div className="flex flex-col">
                        <Text type="secondary" className="!text-xs">
                          三级停电
                        </Text>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-bold text-gray-600">
                            {kpiData.level3}
                          </span>
                          <span className="text-xs text-gray-400">座</span>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card
                      size="small"
                      className="!rounded-md hover:!shadow-md transition-shadow"
                      styles={{ body: { padding: '10px 12px' } }}
                    >
                      <div className="flex flex-col">
                        <Text type="secondary" className="!text-xs">
                          损失容量
                        </Text>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-bold text-dispatch-700">
                            {kpiData.lostCapacity}
                          </span>
                          <span className="text-xs text-gray-400">MVA</span>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </div>

              <div className="w-full flex-shrink-0">
                <Title
                  level={5}
                  className="!text-sm !mb-2 !text-dispatch-800 flex items-center gap-1.5"
                >
                  <Zap size={14} className="text-dispatch-600" />
                  受影响变电站
                </Title>
                <Table<AffectedStation>
                  size="small"
                  columns={tableColumns}
                  dataSource={affectedStations}
                  rowKey="id"
                  pagination={{
                    pageSize: 3,
                    size: 'small',
                    showSizeChanger: false,
                    className: '!mb-0',
                  }}
                  scroll={{ y: 200 }}
                  className="!rounded-md"
                />
              </div>

              <div className="w-full flex-1 min-h-0 overflow-hidden flex flex-col">
                <Title
                  level={5}
                  className="!text-sm !mb-2 !text-dispatch-800 flex items-center gap-1.5 flex-shrink-0"
                >
                  <Lightbulb size={14} className="text-amber-500" />
                  负荷转移建议
                </Title>
                <List
                  className="flex-1 overflow-y-auto !pr-1"
                  dataSource={transferSuggestions}
                  locale={{ emptyText: '暂无负荷转移建议' }}
                  renderItem={(item) => (
                    <List.Item className="!px-0 !py-2 !border-b !border-gray-100 last:!border-0">
                      <Card
                        size="small"
                        className="w-full !rounded-md hover:!shadow-card-hover transition-shadow"
                        styles={{ body: { padding: '10px 12px' } }}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <Tag
                              color={priorityTagColor[item.priority]}
                              className="!mr-0"
                            >
                              {priorityTagText[item.priority]}
                            </Tag>
                            <span className="text-xs text-dispatch-600 font-mono bg-dispatch-50 px-2 py-0.5 rounded">
                              {item.estimatedCapacity} MVA
                            </span>
                          </div>
                          <Paragraph
                            className="!text-xs !text-gray-600 !mb-0 !leading-relaxed"
                            ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                          >
                            {item.description}
                          </Paragraph>
                          <div className="mt-1 pt-2 border-t border-dashed border-gray-100">
                            <div className="flex items-start gap-1.5 mb-1">
                              <Settings2 size={12} className="text-dispatch-500 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-gray-500 font-medium">
                                开关操作
                              </span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4.5">
                              {item.switchOperations.map((op, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1.5 text-xs"
                                >
                                  <ArrowRight
                                    size={10}
                                    className="text-gray-400 flex-shrink-0"
                                  />
                                  <span className="text-gray-600">{op}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </List.Item>
                  )}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

function getOutageLevel(voltageLevel: Substation['voltageLevel']): OutageLevel {
  switch (voltageLevel) {
    case '500kV':
      return 'level1';
    case '220kV':
      return 'level2';
    case '110kV':
      return 'level3';
    default:
      return 'level3';
  }
}

export default TopologyViewer;
