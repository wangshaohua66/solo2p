import KPICards from '@/components/Statistics/KPICards';
import CategoryCharts from '@/components/Statistics/CategoryCharts';
import ExportPanel from '@/components/Statistics/ExportPanel';

const StatisticsReport = () => {
  return (
    <div className="page-container space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">统计分析报表</h1>
        <p className="text-sm text-slate-500">全方位统计检修计划执行情况，辅助运营决策</p>
      </div>

      <KPICards />
      <CategoryCharts />
      <ExportPanel />
    </div>
  );
};

export default StatisticsReport;
