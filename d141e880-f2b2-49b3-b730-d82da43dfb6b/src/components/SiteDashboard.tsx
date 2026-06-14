import React, { useMemo, useState } from 'react';
import { Card, Statistic, Row, Col, Select, DatePicker, Tag, Progress, Tooltip } from 'antd';
import { Calendar, MapPin, Users, Clock, AlertTriangle, CheckCircle, Loader, Grid3X3, Box } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useSiteStore } from '@/stores/siteStore';
import { useArtifactStore } from '@/stores/artifactStore';
import { useGridProgress } from '@/hooks/useStrataSync';
import { getSiteStatusLabel, getProgressColor } from '@/utils/color';
import { SITE_STATUS_OPTIONS, USER_ROLE_OPTIONS } from '@/constants';
import type { Site } from '@/types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface SiteDashboardProps {
  onSiteSelect?: (site: Site) => void;
}

const SiteDashboard: React.FC<SiteDashboardProps> = ({ onSiteSelect }) => {
  const sites = useSiteStore((state) => state.sites);
  const users = useSiteStore((state) => state.users);
  const grids = useSiteStore((state) => state.grids);
  const getArtifactsBySite = useArtifactStore((state) => state.getArtifactsBySite);
  const getArtifactsStats = useArtifactStore((state) => state.getArtifactsStats);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      if (statusFilter !== 'all' && site.status !== statusFilter) return false;
      if (managerFilter !== 'all' && site.managerId !== managerFilter) return false;
      if (dateRange) {
        const siteStart = dayjs(site.startDate);
        const siteEnd = dayjs(site.endDate);
        if (siteEnd.isBefore(dateRange[0]) || siteStart.isAfter(dateRange[1])) return false;
      }
      return true;
    });
  }, [sites, statusFilter, managerFilter, dateRange]);

  const stats = useMemo(() => {
    const totalSites = sites.length;
    const activeSites = sites.filter((s) => s.status === 'excavating').length;
    const completedSites = sites.filter((s) => s.status === 'completed').length;
    const totalGrids = grids.length;
    const completedGrids = grids.filter((g) => g.status === 'completed').length;
    const excavatingGrids = grids.filter((g) => g.status === 'excavating').length;
    const totalArtifacts = getArtifactsStats().total;

    const today = dayjs();
    const overdueSites = sites.filter((s) => {
      if (s.status === 'completed') return false;
      return dayjs(s.endDate).isBefore(today);
    }).length;

    return {
      totalSites,
      activeSites,
      completedSites,
      totalGrids,
      completedGrids,
      excavatingGrids,
      totalArtifacts,
      overdueSites,
    };
  }, [sites, grids, getArtifactsStats]);

  const getManagerName = (managerId: string) => {
    return users.find((u) => u.id === managerId)?.name || '未分配';
  };

  const ganttChartOption = useMemo(() => {
    const siteData = filteredSites.map((site) => {
      const progress = useGridProgress(site.id).progress;
      const isOverdue = dayjs(site.endDate).isBefore(dayjs()) && site.status !== 'completed';
      const startDate = dayjs(site.startDate);
      const endDate = dayjs(site.endDate);
      const duration = endDate.diff(startDate, 'day');
      
      return {
        name: site.name,
        value: [
          filteredSites.indexOf(site),
          startDate.valueOf(),
          endDate.valueOf(),
          duration,
          progress,
          isOverdue,
        ],
        itemStyle: {
          color: isOverdue ? '#DC2626' : getProgressColor(progress, isOverdue),
        },
      };
    });

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const data = params[0]?.data;
          if (!data) return '';
          const site = filteredSites[data.value[0]];
          const progress = data.value[4];
          const isOverdue = data.value[5];
          return `
            <div class="p-2">
              <div class="font-bold">${site.name}</div>
              <div>位置: ${site.location}</div>
              <div>工期: ${site.startDate} ~ ${site.endDate}</div>
              <div>进度: ${progress}%</div>
              ${isOverdue ? '<div class="text-red-500">已逾期!</div>' : ''}
            </div>
          `;
        },
      },
      grid: {
        left: '15%',
        right: '5%',
        top: '10%',
        bottom: '10%',
      },
      xAxis: {
        type: 'time',
        min: dayjs().subtract(6, 'month').valueOf(),
        max: dayjs().add(12, 'month').valueOf(),
        axisLabel: {
          formatter: (value: number) => dayjs(value).format('YYYY-MM'),
        },
      },
      yAxis: {
        type: 'category',
        data: filteredSites.map((s) => s.name),
        axisLabel: {
          fontSize: 12,
        },
      },
      series: [
        {
          type: 'custom',
          renderItem: (params: any, api: any) => {
            const categoryIndex = api.value(0);
            const start = api.coord([api.value(1), categoryIndex]);
            const end = api.coord([api.value(2), categoryIndex]);
            const height = api.size([0, 1])[1] * 0.6;
            const progress = api.value(4);
            const isOverdue = api.value(5);
            const baseColor = isOverdue ? '#DC2626' : getProgressColor(progress, isOverdue);

            return {
              type: 'group',
              children: [
                {
                  type: 'rect',
                  shape: {
                    x: start[0],
                    y: start[1] - height / 2,
                    width: end[0] - start[0],
                    height,
                    r: 4,
                  },
                  style: {
                    fill: '#E5E7EB',
                    stroke: '#D1D5DB',
                    lineWidth: 1,
                  },
                },
                {
                  type: 'rect',
                  shape: {
                    x: start[0],
                    y: start[1] - height / 2,
                    width: (end[0] - start[0]) * (progress / 100),
                    height,
                    r: 4,
                  },
                  style: {
                    fill: baseColor,
                    stroke: baseColor,
                    lineWidth: 1,
                  },
                },
                {
                  type: 'text',
                  x: start[0] + (end[0] - start[0]) / 2,
                  y: start[1] + 4,
                  style: {
                    text: `${progress}%`,
                    fill: progress > 50 ? '#fff' : '#374151',
                    fontSize: 11,
                    fontWeight: 'bold',
                    textAlign: 'center',
                  },
                },
              ],
            };
          },
          data: siteData,
        },
      ],
    };
  }, [filteredSites]);

  const categoryChartOption = useMemo(() => {
    const artifactStats = getArtifactsStats();
    const data = artifactStats.byCategory
      .map((item) => ({
        name: item.category === 'pottery' ? '陶器' :
              item.category === 'bronze' ? '铜器' :
              item.category === 'jade' ? '玉器' :
              item.category === 'stone' ? '石器' :
              item.category === 'bone' ? '骨器' :
              item.category === 'porcelain' ? '瓷器' : '其他',
        value: item.count,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}件 ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: {
          fontSize: 11,
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
          data,
          color: ['#8B4513', '#B8860B', '#CD853F', '#D2691E', '#A0522D', '#DAA520', '#D2B48C'],
        },
      ],
    };
  }, [getArtifactsStats]);

  const renderSiteCard = (site: Site) => {
    const progress = useGridProgress(site.id);
    const isOverdue = dayjs(site.endDate).isBefore(dayjs()) && site.status !== 'completed';
    const artifactsCount = getArtifactsBySite(site.id).length;
    const managerName = getManagerName(site.managerId);

    return (
      <Card
        key={site.id}
        size="small"
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => {
          useSiteStore.getState().setCurrentSite(site.id);
          onSiteSelect?.(site);
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold text-stone-800 mb-1">{site.name}</h4>
            <div className="flex items-center gap-1 text-xs text-stone-500">
              <MapPin size={12} />
              <span>{site.location}</span>
            </div>
          </div>
          <Tag
            color={
              site.status === 'completed'
                ? 'success'
                : site.status === 'excavating'
                ? 'processing'
                : 'default'
            }
          >
            {getSiteStatusLabel(site.status)}
          </Tag>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 text-xs">
            <Users size={12} className="text-stone-400" />
            <span className="text-stone-600">负责人: {managerName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Calendar size={12} className="text-stone-400" />
            <span className="text-stone-600">
              {site.startDate} ~ {site.endDate}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock size={12} className="text-stone-400" />
            <span className="text-stone-600">
              探方: {progress.total} | 遗物: {artifactsCount}件
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-stone-600">发掘进度</span>
            <span className={isOverdue ? 'text-red-600 font-medium' : 'text-stone-700'}>
              {isOverdue && <AlertTriangle size={12} className="inline mr-1" />}
              {progress.progress}%
            </span>
          </div>
          <Progress
            percent={progress.progress}
            size="small"
            strokeColor={isOverdue ? '#DC2626' : getProgressColor(progress.progress, isOverdue)}
            showInfo={false}
          />
        </div>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">工地总览</h2>
          <p className="text-stone-500 mt-1">查看所有发掘工地的进度与统计</p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'all', label: '全部' },
              ...SITE_STATUS_OPTIONS,
            ]}
          />
          <Select
            placeholder="负责人"
            value={managerFilter}
            onChange={setManagerFilter}
            style={{ width: 140 }}
            allowClear
            options={[
              { value: 'all', label: '全部' },
              ...users.map((u) => ({ value: u.id, label: u.name })),
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={setDateRange as any}
            placeholder={['开始日期', '结束日期']}
          />
        </div>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总工地数"
              value={stats.totalSites}
              prefix={<MapPin size={18} className="text-amber-600" />}
              valueStyle={{ color: '#8B4513' }}
            />
            <div className="flex gap-4 mt-2 text-xs text-stone-500">
              <span>
                <span className="text-green-600 font-medium">{stats.activeSites}</span> 进行中
              </span>
              <span>
                <span className="text-blue-600 font-medium">{stats.completedSites}</span> 已完成
              </span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总探方数"
              value={stats.totalGrids}
              prefix={<Grid3X3 size={18} className="text-amber-600" />}
              valueStyle={{ color: '#8B4513' }}
            />
            <div className="flex gap-4 mt-2 text-xs text-stone-500">
              <span>
                <span className="text-green-600 font-medium">{stats.completedGrids}</span> 已完成
              </span>
              <span>
                <span className="text-amber-600 font-medium">{stats.excavatingGrids}</span> 发掘中
              </span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="出土遗物"
              value={stats.totalArtifacts}
              prefix={<Box size={18} className="text-amber-600" />}
              valueStyle={{ color: '#8B4513' }}
            />
            <div className="mt-2 text-xs text-stone-500">
              包含陶器、铜器、玉器等多个类别
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="逾期工地"
              value={stats.overdueSites}
              prefix={<AlertTriangle size={18} className="text-red-600" />}
              valueStyle={{ color: stats.overdueSites > 0 ? '#DC2626' : '#228B22' }}
            />
            <div className="mt-2 text-xs text-stone-500">
              {stats.overdueSites > 0
                ? '请关注逾期项目进度'
                : '所有项目进度正常'}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="发掘进度甘特图" size="small">
            {filteredSites.length > 0 ? (
              <ReactECharts
                option={ganttChartOption}
                style={{ height: 400 }}
                notMerge
                lazyUpdate
              />
            ) : (
              <div className="h-96 flex items-center justify-center text-stone-400">
                暂无符合条件的工地数据
              </div>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="遗物类别分布" size="small">
            <ReactECharts
              option={categoryChartOption}
              style={{ height: 400 }}
              notMerge
              lazyUpdate
            />
          </Card>
        </Col>
      </Row>

      <div>
        <h3 className="text-lg font-semibold text-stone-800 mb-4">工地列表</h3>
        {filteredSites.length > 0 ? (
          <Row gutter={[16, 16]}>
            {filteredSites.map((site) => (
              <Col key={site.id} xs={24} sm={12} md={8} lg={6}>
                {renderSiteCard(site)}
              </Col>
            ))}
          </Row>
        ) : (
          <div className="h-48 flex items-center justify-center text-stone-400 border border-dashed border-stone-300 rounded-lg">
            暂无符合筛选条件的工地
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(SiteDashboard);
