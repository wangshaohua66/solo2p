import TopologyViewer from '@/components/TopologyViewer';

const TopologyView = () => {
  return (
    <div className="page-container space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">电网拓扑视图</h1>
        <p className="text-sm text-slate-500">查看电网拓扑结构、设备连接关系及停电影响范围</p>
      </div>
      <TopologyViewer />
    </div>
  );
};

export default TopologyView;
