import { Site, Grid, Stratum, Artifact, User } from '@/types';
import { generateGridsForSite } from '@/utils/coordinate';

const mockUsers: User[] = [
  { id: 'user_1', name: '张教授', role: 'manager' },
  { id: 'user_2', name: '李考古', role: 'recorder' },
  { id: 'user_3', name: '王研究', role: 'researcher' },
  { id: 'user_4', name: '赵记录', role: 'recorder' },
  { id: 'user_5', name: '陈文博', role: 'manager' },
];

const mockSites: Site[] = [
  {
    id: 'site_1',
    name: '殷墟遗址发掘区A',
    location: '河南省安阳市',
    managerId: 'user_1',
    startDate: '2025-03-01',
    endDate: '2025-12-31',
    status: 'excavating',
    gridRows: 6,
    gridCols: 8,
    description: '商代晚期都城遗址核心发掘区，预计出土大量甲骨文与青铜器',
  },
  {
    id: 'site_2',
    name: '半坡遗址东区',
    location: '陕西省西安市',
    managerId: 'user_5',
    startDate: '2025-04-15',
    endDate: '2025-10-15',
    status: 'excavating',
    gridRows: 5,
    gridCols: 5,
    description: '新石器时代仰韶文化聚落遗址，重点揭露居住区布局',
  },
  {
    id: 'site_3',
    name: '兵马俑坑K9901',
    location: '陕西省西安市临潼区',
    managerId: 'user_1',
    startDate: '2025-01-10',
    endDate: '2025-06-30',
    status: 'completed',
    gridRows: 4,
    gridCols: 6,
    description: '秦始皇陵陪葬坑，已完成全部发掘工作',
  },
  {
    id: 'site_4',
    name: '良渚古城莫角山',
    location: '浙江省杭州市余杭区',
    managerId: 'user_5',
    startDate: '2025-05-01',
    endDate: '2025-11-30',
    status: 'planning',
    gridRows: 8,
    gridCols: 8,
    description: '良渚文化核心宫殿区，计划揭露大型夯土基址',
  },
];

const generateMockGrids = (): Grid[] => {
  let grids: Grid[] = [];
  
  mockSites.forEach((site) => {
    const siteGrids = generateGridsForSite(site.id, site.gridRows, site.gridCols, '');
    
    siteGrids.forEach((grid, index) => {
      const random = Math.random();
      if (site.status === 'completed') {
        grid.status = 'completed';
        grid.artifactCount = Math.floor(Math.random() * 15) + 3;
      } else if (site.status === 'excavating') {
        if (random < 0.3) {
          grid.status = 'completed';
          grid.artifactCount = Math.floor(Math.random() * 10) + 1;
        } else if (random < 0.6) {
          grid.status = 'excavating';
          grid.artifactCount = Math.floor(Math.random() * 5);
        } else {
          grid.status = 'unexcavated';
        }
      }
      
      grid.recorderId = index % 2 === 0 ? 'user_2' : 'user_4';
    });
    
    grids = [...grids, ...siteGrids];
  });
  
  return grids;
};

const generateMockStrata = (grids: Grid[]): Stratum[] => {
  const strata: Stratum[] = [];
  const excavatedGrids = grids.filter((g) => g.status !== 'unexcavated');
  
  excavatedGrids.forEach((grid, gridIndex) => {
    const stratumCount = Math.floor(Math.random() * 4) + 3;
    let currentDepth = 0;
    
    for (let i = 0; i < stratumCount; i++) {
      const thickness = Math.round((Math.random() * 1.5 + 0.3) * 100) / 100;
      const periods = ['新石器时代', '青铜时代', '汉代', '宋代', '明代', '清代'];
      const soilTypes = ['粘土', '砂土', '壤土', '粉土', '混合土'];
      const soilColors = ['黄褐色', '灰褐色', '红褐色', '黑褐色', '灰黄色', '棕褐色'];
      
      strata.push({
        id: `stratum_${grid.id}_${i}`,
        siteId: grid.siteId,
        gridId: grid.id,
        layer: i + 1,
        layerIndex: i,
        name: `第${i + 1}层`,
        soilType: soilTypes[Math.floor(Math.random() * soilTypes.length)],
        soilColor: soilColors[Math.floor(Math.random() * soilColors.length)],
        thickness,
        depthFrom: currentDepth,
        depthTo: Math.round((currentDepth + thickness) * 100) / 100,
        depthTop: currentDepth,
        depthBottom: Math.round((currentDepth + thickness) * 100) / 100,
        period: periods[Math.min(Math.floor(gridIndex / 5 + i), periods.length - 1)],
        description: `${soilColors[Math.floor(Math.random() * soilColors.length)]}${soilTypes[Math.floor(Math.random() * soilTypes.length)]}，包含少量${Math.random() > 0.5 ? '陶片' : '炭屑'}，土质${Math.random() > 0.5 ? '较致密' : '较疏松'}。`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      currentDepth += thickness;
    }
  });
  
  return strata;
};

const generateMockArtifacts = (strata: Stratum[]): Artifact[] => {
  const artifacts: Artifact[] = [];
  const categories = ['pottery', 'bronze', 'jade', 'stone', 'bone', 'porcelain', 'other'];
  const subcategories: Record<string, string[]> = {
    pottery: ['cooking_vessel', 'storage_vessel', 'pottery_fragment'],
    bronze: ['bronze_ritual', 'bronze_weapon', 'bronze_coin'],
    jade: ['jade_ornament', 'jade_ritual'],
    stone: ['stone_tool', 'stone_flake', 'stone_weapon'],
    bone: ['bone_tool', 'animal_bone'],
    porcelain: ['porcelain_vessel', 'porcelain_fragment'],
    other: ['wood', 'lacquer'],
  };
  const conditions: Artifact['condition'][] = ['完好', '较好', '一般', '残损', '严重残损'];
  const names = ['陶鼎', '陶罐', '陶豆', '青铜戈', '青铜鼎', '玉璧', '玉琮', '石斧', '石锛', '骨针', '骨镞', '瓷碗', '瓷瓶', '铜钱', '铁剑', '漆器'];
  
  strata.forEach((stratum) => {
    const artifactCount = Math.floor(Math.random() * 8) + 2;
    
    for (let i = 0; i < artifactCount; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const subcategory = subcategories[category][Math.floor(Math.random() * subcategories[category].length)];
      
      const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
      artifacts.push({
        id: `artifact_${stratum.id}_${i}`,
        stratumId: stratum.id,
        gridId: stratum.gridId,
        siteId: stratum.gridId.split('_grid_')[0],
        name: names[Math.floor(Math.random() * names.length)] + (Math.random() > 0.7 ? '残件' : ''),
        category,
        subcategory,
        quantity: Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 2 : 1,
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        depth: Math.round((stratum.depthTop + Math.random() * stratum.thickness) * 100) / 100,
        offsetX: Math.round(Math.random() * 5 * 100) / 100,
        offsetY: Math.round(Math.random() * 5 * 100) / 100,
        period: stratum.period,
        notes: `出土于${stratum.name}，位置${Math.random() > 0.5 ? '靠近探方南壁' : '靠近探方东壁'}，${Math.random() > 0.5 ? '与红烧土伴出' : '与灰烬伴出'}。`,
        createdAt,
        updatedAt: createdAt,
      });
    }
  });
  
  return artifacts;
};

export const generateMockData = () => {
  const grids = generateMockGrids();
  const strata = generateMockStrata(grids);
  const artifacts = generateMockArtifacts(strata);
  
  return {
    users: mockUsers,
    sites: mockSites,
    grids,
    strata,
    artifacts,
  };
};

export const initializeMockData = () => {
  const existingData = localStorage.getItem('site-storage');
  if (!existingData || JSON.parse(existingData).state.sites.length === 0) {
    const mockData = generateMockData();
    
    const siteStorageData = {
      state: {
        sites: mockData.sites,
        grids: mockData.grids,
        users: mockData.users,
      },
      version: 0,
    };
    
    const artifactStorageData = {
      state: {
        strata: mockData.strata,
        artifacts: mockData.artifacts,
      },
      version: 0,
    };
    
    localStorage.setItem('site-storage', JSON.stringify(siteStorageData));
    localStorage.setItem('artifact-storage', JSON.stringify(artifactStorageData));
    
    console.log('Mock data initialized successfully');
    return mockData;
  }
  
  console.log('Existing data found, skipping mock initialization');
  return null;
};

export const mockArtifactCounts = [
  { category: 'pottery', label: '陶器', count: 1256 },
  { category: 'bronze', label: '铜器', count: 342 },
  { category: 'jade', label: '玉器', count: 156 },
  { category: 'stone', label: '石器', count: 892 },
  { category: 'bone', label: '骨器', count: 678 },
  { category: 'porcelain', label: '瓷器', count: 445 },
  { category: 'other', label: '其他', count: 231 },
];

export const mockPeriodCounts = [
  { period: '旧石器时代', count: 124 },
  { period: '新石器时代', count: 876 },
  { period: '青铜时代', count: 543 },
  { period: '铁器时代', count: 234 },
  { period: '汉代', count: 678 },
  { period: '唐代', count: 345 },
  { period: '宋代', count: 456 },
  { period: '明代', count: 234 },
  { period: '清代', count: 156 },
  { period: '近现代', count: 89 },
];
