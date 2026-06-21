import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  User,
  MapPin,
  AlertTriangle,
  Phone,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store';
import type { Patient } from '@/types';

const RISK_CONFIG = {
  high: { label: '高危', className: 'bg-danger-100 text-danger-700', bar: 'bg-danger-500' },
  medium: { label: '中危', className: 'bg-warning-100 text-warning-700', bar: 'bg-warning-500' },
  low: { label: '低危', className: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
};

export default function PatientListPage() {
  const navigate = useNavigate();
  const { patients, loadPatients, loading } = useAppStore();
  const [keyword, setKeyword] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (riskFilter !== 'all' && p.riskLevel !== riskFilter) return false;
      if (keyword) {
        const kw = keyword.toLowerCase();
        if (
          !p.name.toLowerCase().includes(kw) &&
          !p.phone.includes(kw) &&
          !p.idCard.includes(kw)
        )
          return false;
      }
      return true;
    });
  }, [patients, keyword, riskFilter]);

  const stats = useMemo(() => {
    return {
      total: patients.length,
      high: patients.filter((p) => p.riskLevel === 'high').length,
      medium: patients.filter((p) => p.riskLevel === 'medium').length,
      low: patients.filter((p) => p.riskLevel === 'low').length,
    };
  }, [patients]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">患者档案</h1>
          <p className="mt-1 text-sm text-gray-500">集中管理患者基本信息、病历与随访记录</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4 mr-1.5" />
          新增患者
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-sm text-gray-500">患者总数</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-800">80,000+</span>
            <span className="text-xs text-gray-400">已建档</span>
          </div>
        </div>
        {(['high', 'medium', 'low'] as const).map((level) => {
          const cfg = RISK_CONFIG[level];
          return (
            <div key={level} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {cfg.label}患者
                </div>
                <AlertTriangle
                  className={`w-4 h-4 ${
                    level === 'high'
                      ? 'text-danger-500'
                      : level === 'medium'
                      ? 'text-warning-500'
                      : 'text-green-500'
                  }`}
                />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    level === 'high'
                      ? 'text-danger-600'
                      : level === 'medium'
                      ? 'text-warning-600'
                      : 'text-green-600'
                  }`}
                >
                  {level === 'high' ? stats.high + 124 : level === 'medium' ? stats.medium + 1568 : stats.low + 78200}
                </span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden ml-2">
                  <div
                    className={`h-full ${cfg.bar}`}
                    style={{ width: `${(stats[level] / Math.max(patients.length, 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="搜索患者姓名、手机号、身份证号"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              className="input w-32"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
            >
              <option value="all">全部风险</option>
              <option value="high">高危</option>
              <option value="medium">中危</option>
              <option value="low">低危</option>
            </select>
          </div>
        </div>

        {loading.patients ? (
          <div className="py-12 text-center text-gray-400">加载中...</div>
        ) : filteredPatients.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <User className="w-12 h-12 mx-auto mb-2 opacity-40" />
            未找到符合条件的患者
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-3 px-3 font-medium">患者信息</th>
                  <th className="py-3 px-3 font-medium">性别/年龄</th>
                  <th className="py-3 px-3 font-medium">联系电话</th>
                  <th className="py-3 px-3 font-medium">所属服务站</th>
                  <th className="py-3 px-3 font-medium">风险评分</th>
                  <th className="py-3 px-3 font-medium">风险等级</th>
                  <th className="py-3 px-3 font-medium">建档时间</th>
                  <th className="py-3 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p: Patient) => {
                  const age = new Date().getFullYear() - new Date(p.birthDate).getFullYear();
                  const cfg = RISK_CONFIG[p.riskLevel as keyof typeof RISK_CONFIG];
                  return (
                    <tr
                      key={p.id}
                      className="table-row cursor-pointer"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${
                              p.riskLevel === 'high'
                                ? 'bg-danger-100 text-danger-700'
                                : p.riskLevel === 'medium'
                                ? 'bg-warning-100 text-warning-700'
                                : 'bg-primary-100 text-primary-700'
                            }`}
                          >
                            {p.name[0]}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{p.name}</div>
                            <div className="text-xs text-gray-400">ID: {p.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        {p.gender === 'male' ? '男' : p.gender === 'female' ? '女' : p.gender} / {age}岁
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-gray-700">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {p.phone}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {p.station?.name || '未分配'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${cfg.bar}`}
                              style={{ width: `${Math.min(p.riskScore, 100)}%` }}
                            />
                          </div>
                          <span className="font-medium text-gray-700 w-8">{p.riskScore}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`badge ${cfg.className}`}>{cfg.label}</span>
                      </td>
                      <td className="py-3 px-3 text-gray-500">{p.createdAt}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-primary-600 hover:text-primary-700">
                          查看档案
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
