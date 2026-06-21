import { useMemo, useState } from 'react';
import { Tree, Input } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  Search,
  Building2,
  Zap,
  Power,
  PanelBottom,
  Route,
  Locate,
} from 'lucide-react';
import type {
  Substation,
  Equipment,
  VoltageLevel,
  EquipmentType,
} from '@/types';
import { useEquipmentStore } from '@/store/equipmentStore';
import { shallow } from 'zustand/shallow';

const { Search: AntSearch } = Input;

const voltageLevelOrder: VoltageLevel[] = ['500kV', '220kV', '110kV'];

const voltageLevelLabels: Record<VoltageLevel, string> = {
  '500kV': '500千伏',
  '220kV': '220千伏',
  '110kV': '110千伏',
};

const equipmentIconMap: Record<EquipmentType, React.ReactNode> = {
  transformer: <Zap className="w-4 h-4 text-amber-500" />,
  breaker: <Power className="w-4 h-4 text-dispatch-600" />,
  disconnector: <Power className="w-4 h-4 text-dispatch-400" />,
  busbar: <PanelBottom className="w-4 h-4 text-emerald-600" />,
  line: <Route className="w-4 h-4 text-sky-600" />,
};

interface EquipmentTreeProps {
  onSelect?: (id: string) => void;
}

const EquipmentTree: React.FC<EquipmentTreeProps> = ({ onSelect }) => {
  const [searchText, setSearchText] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  const {
    substations,
    equipments,
    selectedEquipmentId,
    selectEquipment,
    lines,
  } = useEquipmentStore(
    (state) => ({
      substations: state.substations,
      equipments: state.equipments,
      selectedEquipmentId: state.selectedEquipmentId,
      selectEquipment: state.selectEquipment,
      lines: state.lines,
    }),
    shallow
  );

  const handleEquipmentSelect = (id: string) => {
    selectEquipment(id);
    onSelect?.(id);
  };

  const buildTreeNodes = (): DataNode[] => {
    const lowerSearch = searchText.trim().toLowerCase();
    const result: DataNode[] = [];

    voltageLevelOrder.forEach((voltage) => {
      const stationsInVoltage = substations.filter(
        (s) => s.voltageLevel === voltage
      );
      if (stationsInVoltage.length === 0) return;

      const stationNodes: DataNode[] = stationsInVoltage
        .map((station) => buildStationNode(station, lowerSearch))
        .filter((n) => n !== null) as DataNode[];

      if (stationNodes.length === 0) return;

      result.push({
        key: `voltage-${voltage}`,
        title: (
          <span className="flex items-center gap-2 font-semibold text-dispatch-700">
            <span className="w-2 h-2 rounded-full bg-dispatch-500" />
            {voltageLevelLabels[voltage]}
            <span className="text-xs font-normal text-gray-400">
              ({stationNodes.length})
            </span>
          </span>
        ),
        children: stationNodes,
      });
    });

    return result;
  };

  const buildStationNode = (
    station: Substation,
    lowerSearch: string
  ): DataNode | null => {
    const stationEquipments = equipments.filter(
      (e) => e.substationId === station.id && !e.parentId
    );
    const stationLines = lines.filter(
      (l) => l.fromStationId === station.id || l.toStationId === station.id
    );

    const equipmentNodes = stationEquipments
      .map((eq) => buildEquipmentNode(eq, lowerSearch))
      .filter((n) => n !== null) as DataNode[];

    const lineNodes: DataNode[] = [];
    stationLines.forEach((line, idx) => {
      if (
        lowerSearch &&
        !line.name.toLowerCase().includes(lowerSearch) &&
        !station.name.toLowerCase().includes(lowerSearch)
      ) {
        return;
      }
      const directionTag =
        line.fromStationId === station.id ? 'from' : 'to';
      lineNodes.push({
        key: `line-${station.id}-${directionTag}-${line.id}-${idx}`,
        title: (
          <span className="flex items-center gap-2">
            <Route className="w-4 h-4 text-sky-600" />
            <span className="text-gray-700">{line.name}</span>
            <span className="text-xs text-gray-400">
              {line.lengthKm}km
            </span>
          </span>
        ),
      });
    });

    const children = [...equipmentNodes, ...lineNodes];

    const matchesSearch =
      !lowerSearch ||
      station.name.toLowerCase().includes(lowerSearch) ||
      children.length > 0;

    if (!matchesSearch) return null;

    return {
      key: `station-${station.id}`,
      title: (
        <span className="flex items-center gap-2 group">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span className="text-gray-800 font-medium">{station.name}</span>
          <button
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-dispatch-50 rounded"
            onClick={(e) => {
              e.stopPropagation();
              handleEquipmentSelect(station.id);
            }}
            title="定位到拓扑图"
          >
            <Locate className="w-3.5 h-3.5 text-dispatch-500" />
          </button>
        </span>
      ),
      children: children.length > 0 ? children : undefined,
    };
  };

  const buildEquipmentNode = (
    equipment: Equipment,
    lowerSearch: string
  ): DataNode | null => {
    const childEquipments = equipments.filter(
      (e) => e.parentId === equipment.id
    );

    const childNodes = childEquipments
      .map((eq) => buildEquipmentNode(eq, lowerSearch))
      .filter((n) => n !== null) as DataNode[];

    const matchesSearch =
      !lowerSearch ||
      equipment.name.toLowerCase().includes(lowerSearch) ||
      childNodes.length > 0;

    if (!matchesSearch) return null;

    return {
      key: `equipment-${equipment.id}`,
      title: (
        <span className="flex items-center gap-2 group">
          {equipmentIconMap[equipment.type]}
          <span className="text-gray-700">{equipment.name}</span>
          {equipment.ratedCapacity && (
            <span className="text-xs text-gray-400">
              {equipment.ratedCapacity}MVA
            </span>
          )}
          <button
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-dispatch-50 rounded"
            onClick={(e) => {
              e.stopPropagation();
              handleEquipmentSelect(equipment.id);
            }}
            title="定位到拓扑图"
          >
            <Locate className="w-3.5 h-3.5 text-dispatch-500" />
          </button>
        </span>
      ),
      children: childNodes.length > 0 ? childNodes : undefined,
    };
  };

  const treeData = useMemo(() => buildTreeNodes(), [
    substations,
    equipments,
    lines,
    searchText,
  ]);

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) return;
    const key = selectedKeys[0] as string;
    if (key.startsWith('station-')) {
      handleEquipmentSelect(key.replace('station-', ''));
    } else if (key.startsWith('equipment-')) {
      handleEquipmentSelect(key.replace('equipment-', ''));
    } else if (key.startsWith('line-')) {
      const matchedLine = lines.find((l) => key.includes(l.id));
      handleEquipmentSelect(matchedLine ? matchedLine.id : key);
    }
  };

  const selectedKeys: React.Key[] = useMemo(() => {
    if (!selectedEquipmentId) return [];
    const keys: React.Key[] = [
      `station-${selectedEquipmentId}`,
      `equipment-${selectedEquipmentId}`,
    ];
    lines.forEach((line) => {
      if (line.id === selectedEquipmentId) {
        keys.push(`line-${line.fromStationId}-from-${line.id}-0`);
        keys.push(`line-${line.toStationId}-to-${line.id}-0`);
      }
    });
    return keys;
  }, [selectedEquipmentId, lines]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-3 border-b border-gray-100">
        <AntSearch
          prefix={<Search className="w-4 h-4 text-gray-400" />}
          placeholder="搜索变电站/设备/线路"
          allowClear
          value={searchText}
          onChange={(e) => {
            const value = e.target.value;
            setSearchText(value);
            if (value) {
              const keysToExpand: React.Key[] = [];
              voltageLevelOrder.forEach((v) => {
                keysToExpand.push(`voltage-${v}`);
              });
              substations.forEach((s) => {
                keysToExpand.push(`station-${s.id}`);
              });
              setExpandedKeys(keysToExpand);
              setAutoExpandParent(true);
            }
          }}
          className="w-full"
          size="small"
        />
      </div>
      <div className="flex-1 overflow-auto p-2 min-h-0">
        <Tree
          showLine={{ showLeafIcon: false }}
          blockNode
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={(keys) => {
            setExpandedKeys(keys);
            setAutoExpandParent(false);
          }}
          autoExpandParent={autoExpandParent}
          selectedKeys={selectedKeys}
          onSelect={handleSelect}
          switcherIcon={<span className="text-dispatch-500" />}
          className="equipment-tree"
        />
      </div>
    </div>
  );
};

export default EquipmentTree;
