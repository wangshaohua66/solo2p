// 真实地理坐标配置 - 以安徽省为例
// 所有坐标基于 WGS84 坐标系

export interface RegionConfig {
  code: string;
  name: string;
  level: number;
  center: [number, number];
  bounds: [[number, number], [number, number]];
  cities: CityConfig[];
}

export interface CityConfig {
  code: string;
  name: string;
  center: [number, number];
  counties: CountyConfig[];
}

export interface CountyConfig {
  code: string;
  name: string;
  center: [number, number];
}

export const MAP_CENTER: [number, number] = [31.8639, 117.2808];
export const MAP_ZOOM = 8;
export const MAP_MIN_ZOOM = 6;
export const MAP_MAX_ZOOM = 18;

export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [29.4, 114.9],
  [34.6, 119.6],
];

export const ANHUI_PROVINCE: RegionConfig = {
  code: '340000',
  name: '安徽省',
  level: 1,
  center: MAP_CENTER,
  bounds: MAP_BOUNDS,
  cities: [
    {
      code: '340100',
      name: '合肥市',
      center: [31.8206, 117.2272],
      counties: [
        { code: '340102', name: '瑶海区', center: [31.86, 117.31] },
        { code: '340103', name: '庐阳区', center: [31.88, 117.27] },
        { code: '340104', name: '蜀山区', center: [31.85, 117.23] },
        { code: '340111', name: '包河区', center: [31.82, 117.29] },
        { code: '340121', name: '长丰县', center: [32.48, 117.16] },
        { code: '340122', name: '肥东县', center: [31.89, 117.46] },
        { code: '340123', name: '肥西县', center: [31.71, 117.14] },
        { code: '340124', name: '庐江县', center: [31.26, 117.29] },
        { code: '340181', name: '巢湖市', center: [31.60, 117.87] },
      ],
    },
    {
      code: '340200',
      name: '芜湖市',
      center: [31.3558, 118.4258],
      counties: [
        { code: '340202', name: '镜湖区', center: [31.34, 118.44] },
        { code: '340203', name: '弋江区', center: [31.30, 118.41] },
        { code: '340207', name: '鸠江区', center: [31.38, 118.39] },
        { code: '340208', name: '三山区', center: [31.21, 118.27] },
        { code: '340221', name: '芜湖县', center: [31.15, 118.56] },
        { code: '340223', name: '南陵县', center: [30.91, 118.32] },
        { code: '340225', name: '无为县', center: [31.30, 117.91] },
      ],
    },
    {
      code: '340300',
      name: '蚌埠市',
      center: [32.9401, 117.3319],
      counties: [
        { code: '340302', name: '龙子湖区', center: [32.94, 117.37] },
        { code: '340303', name: '蚌山区', center: [32.93, 117.35] },
        { code: '340304', name: '禹会区', center: [32.92, 117.30] },
        { code: '340311', name: '淮上区', center: [32.98, 117.31] },
        { code: '340321', name: '怀远县', center: [32.96, 117.15] },
        { code: '340322', name: '五河县', center: [33.13, 117.87] },
        { code: '340323', name: '固镇县', center: [33.32, 117.32] },
      ],
    },
    {
      code: '340400',
      name: '淮南市',
      center: [32.6450, 117.0034],
      counties: [
        { code: '340402', name: '大通区', center: [32.65, 117.05] },
        { code: '340403', name: '田家庵区', center: [32.63, 117.02] },
        { code: '340404', name: '谢家集区', center: [32.60, 116.94] },
        { code: '340405', name: '八公山区', center: [32.61, 116.85] },
        { code: '340406', name: '潘集区', center: [32.77, 116.82] },
        { code: '340421', name: '凤台县', center: [32.71, 116.71] },
        { code: '340422', name: '寿县', center: [32.58, 116.78] },
      ],
    },
    {
      code: '340500',
      name: '马鞍山市',
      center: [31.6704, 118.5065],
      counties: [
        { code: '340503', name: '花山区', center: [31.68, 118.52] },
        { code: '340504', name: '雨山区', center: [31.65, 118.49] },
        { code: '340506', name: '博望区', center: [31.57, 118.74] },
        { code: '340521', name: '当涂县', center: [31.56, 118.49] },
        { code: '340522', name: '含山县', center: [31.73, 118.11] },
        { code: '340523', name: '和县', center: [31.76, 118.37] },
      ],
    },
    {
      code: '340600',
      name: '淮北市',
      center: [33.9591, 116.7950],
      counties: [
        { code: '340602', name: '杜集区', center: [33.98, 116.82] },
        { code: '340603', name: '相山区', center: [33.96, 116.78] },
        { code: '340604', name: '烈山区', center: [33.90, 116.79] },
        { code: '340621', name: '濉溪县', center: [33.91, 116.74] },
      ],
    },
    {
      code: '340700',
      name: '铜陵市',
      center: [30.9554, 117.8116],
      counties: [
        { code: '340705', name: '铜官区', center: [30.96, 117.81] },
        { code: '340706', name: '义安区', center: [30.93, 117.82] },
        { code: '340711', name: '郊  区', center: [30.89, 117.80] },
        { code: '340722', name: '枞阳县', center: [30.70, 117.22] },
      ],
    },
    {
      code: '340800',
      name: '安庆市',
      center: [30.5260, 117.0350],
      counties: [
        { code: '340811', name: '大观区', center: [30.52, 117.02] },
        { code: '340802', name: '迎江区', center: [30.50, 117.06] },
        { code: '340803', name: '宜秀区', center: [30.58, 117.08] },
        { code: '340822', name: '怀宁县', center: [30.61, 116.83] },
        { code: '340824', name: '潜山市', center: [30.63, 116.58] },
        { code: '340825', name: '太湖县', center: [30.47, 116.28] },
        { code: '340826', name: '宿松县', center: [30.15, 116.12] },
        { code: '340827', name: '望江县', center: [30.12, 116.68] },
        { code: '340828', name: '岳西县', center: [30.85, 116.37] },
        { code: '340881', name: '桐城市', center: [31.05, 116.95] },
      ],
    },
    {
      code: '341000',
      name: '黄山市',
      center: [29.7136, 118.3334],
      counties: [
        { code: '341002', name: '屯溪区', center: [29.71, 118.32] },
        { code: '341003', name: '黄山区', center: [30.11, 118.17] },
        { code: '341004', name: '徽州区', center: [29.83, 118.36] },
        { code: '341021', name: '歙  县', center: [29.87, 118.43] },
        { code: '341022', name: '休宁县', center: [29.79, 118.19] },
        { code: '341023', name: '黟  县', center: [29.93, 117.97] },
        { code: '341024', name: '祁门县', center: [29.86, 117.72] },
      ],
    },
    {
      code: '341100',
      name: '滁州市',
      center: [32.3009, 118.3176],
      counties: [
        { code: '341102', name: '琅琊区', center: [32.31, 118.32] },
        { code: '341103', name: '南谯区', center: [32.27, 118.37] },
        { code: '341122', name: '来安县', center: [32.45, 118.45] },
        { code: '341124', name: '全椒县', center: [32.09, 118.26] },
        { code: '341125', name: '定远县', center: [32.53, 117.69] },
        { code: '341126', name: '凤阳县', center: [32.87, 117.56] },
        { code: '341181', name: '天长市', center: [32.70, 119.01] },
        { code: '341182', name: '明光市', center: [32.78, 117.97] },
      ],
    },
    {
      code: '341200',
      name: '阜阳市',
      center: [32.8980, 115.8148],
      counties: [
        { code: '341202', name: '颍州区', center: [32.89, 115.81] },
        { code: '341203', name: '颍东区', center: [32.91, 115.86] },
        { code: '341204', name: '颍泉区', center: [32.95, 115.81] },
        { code: '341221', name: '临泉县', center: [33.07, 115.26] },
        { code: '341222', name: '太和县', center: [33.17, 115.61] },
        { code: '341225', name: '阜南县', center: [32.62, 115.59] },
        { code: '341226', name: '颍上县', center: [32.63, 116.26] },
        { code: '341282', name: '界首市', center: [33.25, 115.37] },
      ],
    },
    {
      code: '341300',
      name: '宿州市',
      center: [33.6389, 116.9739],
      counties: [
        { code: '341302', name: '埇桥区', center: [33.64, 116.97] },
        { code: '341321', name: '砀山县', center: [34.43, 116.34] },
        { code: '341322', name: '萧  县', center: [34.19, 116.94] },
        { code: '341323', name: '灵璧县', center: [33.54, 117.55] },
        { code: '341324', name: '泗  县', center: [33.48, 117.90] },
      ],
    },
    {
      code: '341500',
      name: '六安市',
      center: [31.7527, 116.4995],
      counties: [
        { code: '341502', name: '金安区', center: [31.76, 116.51] },
        { code: '341503', name: '裕安区', center: [31.74, 116.48] },
        { code: '341504', name: '叶集区', center: [31.87, 116.05] },
        { code: '341522', name: '霍邱县', center: [32.34, 116.27] },
        { code: '341523', name: '舒城县', center: [31.46, 116.93] },
        { code: '341524', name: '金寨县', center: [31.51, 115.86] },
        { code: '341525', name: '霍山县', center: [31.41, 116.33] },
      ],
    },
    {
      code: '341600',
      name: '亳州市',
      center: [33.8637, 115.7826],
      counties: [
        { code: '341602', name: '谯城区', center: [33.86, 115.78] },
        { code: '341621', name: '涡阳县', center: [33.48, 116.20] },
        { code: '341622', name: '蒙城县', center: [33.27, 116.55] },
        { code: '341623', name: '利辛县', center: [33.13, 116.22] },
      ],
    },
    {
      code: '341700',
      name: '池州市',
      center: [30.6549, 117.4842],
      counties: [
        { code: '341702', name: '贵池区', center: [30.65, 117.48] },
        { code: '341721', name: '东至县', center: [30.10, 117.03] },
        { code: '341722', name: '石台县', center: [30.18, 117.49] },
        { code: '341723', name: '青阳县', center: [30.64, 117.85] },
      ],
    },
    {
      code: '341800',
      name: '宣城市',
      center: [30.9515, 118.7579],
      counties: [
        { code: '341802', name: '宣州区', center: [30.95, 118.76] },
        { code: '341821', name: '郎溪县', center: [31.13, 119.17] },
        { code: '341822', name: '广德县', center: [30.90, 119.42] },
        { code: '341823', name: '泾  县', center: [30.68, 118.42] },
        { code: '341824', name: '绩溪县', center: [30.07, 118.58] },
        { code: '341825', name: '旌德县', center: [30.29, 118.55] },
        { code: '341881', name: '宁国市', center: [30.63, 118.96] },
      ],
    },
  ],
};

export const PROVINCIAL_EMERGENCY_CENTER: [number, number] = [31.8639, 117.2808];

export const RESCUE_BASES: Array<{
  id: string;
  name: string;
  type: string;
  position: [number, number];
  capacity: number;
  leader: string;
  phone: string;
}> = [
  { id: 'BASE-001', name: '省应急救援总队', type: '综合救援', position: [31.8639, 117.2808], capacity: 200, leader: '王队长', phone: '13900000001' },
  { id: 'BASE-002', name: '省消防救援总队', type: '消防救援', position: [31.8539, 117.2908], capacity: 300, leader: '李队长', phone: '13900000002' },
  { id: 'BASE-003', name: '省医疗救援队', type: '医疗救援', position: [31.8439, 117.2708], capacity: 80, leader: '张队长', phone: '13900000003' },
  { id: 'BASE-004', name: '合肥市综合救援队', type: '综合救援', position: [31.8206, 117.2272], capacity: 100, leader: '赵队长', phone: '13900000004' },
  { id: 'BASE-005', name: '芜湖市综合救援队', type: '综合救援', position: [31.3558, 118.4258], capacity: 80, leader: '钱队长', phone: '13900000005' },
  { id: 'BASE-006', name: '蚌埠市综合救援队', type: '综合救援', position: [32.9401, 117.3319], capacity: 80, leader: '孙队长', phone: '13900000006' },
  { id: 'BASE-007', name: '安庆市综合救援队', type: '综合救援', position: [30.5260, 117.0350], capacity: 80, leader: '周队长', phone: '13900000007' },
  { id: 'BASE-008', name: '阜阳市综合救援队', type: '综合救援', position: [32.8980, 115.8148], capacity: 80, leader: '吴队长', phone: '13900000008' },
  { id: 'BASE-009', name: '黄山市山地救援队', type: '山地救援', position: [29.7136, 118.3334], capacity: 40, leader: '郑队长', phone: '13900000009' },
  { id: 'BASE-010', name: '滁州市水域救援队', type: '水域救援', position: [32.3009, 118.3176], capacity: 50, leader: '冯队长', phone: '13900000010' },
];

export const WAREHOUSE_LOCATIONS: Array<{
  id: string;
  name: string;
  type: number;
  position: [number, number];
  capacity: number;
  manager: string;
  phone: string;
}> = [
  { id: 'WH-001', name: '省级中心仓库', type: 1, position: [31.8339, 117.3008], capacity: 50000, manager: '刘主任', phone: '13700000001' },
  { id: 'WH-002', name: '省级救灾物资储备库', type: 2, position: [31.8839, 117.2508], capacity: 80000, manager: '陈主任', phone: '13700000002' },
  { id: 'WH-003', name: '合肥市物资仓库', type: 1, position: [31.8006, 117.2072], capacity: 20000, manager: '杨主任', phone: '13700000003' },
  { id: 'WH-004', name: '芜湖市物资仓库', type: 1, position: [31.3358, 118.4058], capacity: 20000, manager: '黄主任', phone: '13700000004' },
  { id: 'WH-005', name: '蚌埠市物资仓库', type: 1, position: [32.9201, 117.3119], capacity: 20000, manager: '朱主任', phone: '13700000005' },
  { id: 'WH-006', name: '安庆市物资仓库', type: 1, position: [30.5060, 117.0150], capacity: 15000, manager: '秦主任', phone: '13700000006' },
  { id: 'WH-007', name: '阜阳市物资仓库', type: 1, position: [32.8780, 115.7948], capacity: 20000, manager: '尤主任', phone: '13700000007' },
  { id: 'WH-008', name: '六安市物资仓库', type: 1, position: [31.7327, 116.4795], capacity: 15000, manager: '许主任', phone: '13700000008' },
];

export function getLocationByRegionCode(regionCode: string): [number, number] | null {
  for (const city of ANHUI_PROVINCE.cities) {
    if (city.code === regionCode || regionCode.startsWith(city.code.slice(0, 4))) {
      return city.center;
    }
    for (const county of city.counties) {
      if (county.code === regionCode) {
        return county.center;
      }
    }
  }
  return MAP_CENTER;
}

export function getOrganizationLocation(orgId: number): [number, number] {
  const locationMap: Record<number, [number, number]> = {
    1: [31.8639, 117.2808],
    2: [31.8206, 117.2272],
    3: [31.3558, 118.4258],
    4: [32.9401, 117.3319],
    11: [31.86, 117.31],
    12: [31.88, 117.27],
    13: [31.85, 117.23],
    21: [32.6450, 117.0034],
    22: [33.6389, 116.9739],
    23: [33.8637, 115.7826],
    31: [30.5260, 117.0350],
    32: [30.6549, 117.4842],
    33: [30.9515, 118.7579],
  };
  return locationMap[orgId] || MAP_CENTER;
}

export function getTeamLocation(teamId: number): [number, number] {
  const index = (teamId - 1) % RESCUE_BASES.length;
  return RESCUE_BASES[index].position;
}

export function getWarehouseLocation(warehouseId: number): [number, number] {
  const index = (warehouseId - 1) % WAREHOUSE_LOCATIONS.length;
  return WAREHOUSE_LOCATIONS[index].position;
}
