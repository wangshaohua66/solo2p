<?php

namespace App\Service;

use App\Entity\Movement;
use App\Repository\MovementRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Cache\CacheItemPoolInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class MovementService
{
    private const CACHE_TTL = 1800;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly MovementRepository $movementRepo,
        private readonly CacheItemPoolInterface $cache,
        private readonly LoggerInterface $logger,
    ) {}

    public function list(array $filters = [], int $page = 1, int $pageSize = 100): array
    {
        $cacheKey = sprintf('mv_list_%s_%d_%d', md5(json_encode($filters)), $page, $pageSize);
        $cacheItem = $this->cache->getItem($cacheKey);
        if ($cacheItem->isHit()) {
            return $cacheItem->get();
        }

        $qb = $this->movementRepo->createQueryBuilder('m');

        if (!empty($filters['keyword'])) {
            $kw = '%' . $filters['keyword'] . '%';
            $qb->andWhere(
                $qb->expr()->orX(
                    'm.code LIKE :kw',
                    'm.brand LIKE :kw',
                    'm.commonName LIKE :kw',
                    'm.description LIKE :kw'
                )
            )->setParameter('kw', $kw);
        }

        if (!empty($filters['brand'])) {
            if (is_array($filters['brand'])) {
                $qb->andWhere('m.brand IN (:brands)')
                    ->setParameter('brands', $filters['brand']);
            } else {
                $qb->andWhere('m.brand = :brand')
                    ->setParameter('brand', $filters['brand']);
            }
        }

        if (!empty($filters['family'])) {
            $qb->andWhere('m.family = :f')->setParameter('f', $filters['family']);
        }

        if (!empty($filters['jewelsFrom'])) {
            $qb->andWhere('m.jewels >= :jf')->setParameter('jf', (int)$filters['jewelsFrom']);
        }

        $qb->orderBy('m.brand', 'ASC')
            ->addOrderBy('m.code', 'ASC');

        $total = (clone $qb)->select('COUNT(m.id)')->getQuery()->getSingleScalarResult();

        $offset = ($page - 1) * $pageSize;
        $data = $qb->setFirstResult($offset)
            ->setMaxResults($pageSize)
            ->getQuery()
            ->getResult();

        $result = [
            'data' => $data,
            'total' => (int)$total,
            'page' => $page,
            'pageSize' => $pageSize,
            'brandGrouped' => $this->groupByBrand($data),
        ];

        $cacheItem->set($result);
        $cacheItem->expiresAfter(self::CACHE_TTL);
        $this->cache->save($cacheItem);

        return $result;
    }

    public function get(int $id): Movement
    {
        $cacheKey = 'mv_detail_' . $id;
        $cacheItem = $this->cache->getItem($cacheKey);
        if ($cacheItem->isHit()) {
            return $cacheItem->get();
        }

        $movement = $this->movementRepo->find($id);
        if (!$movement) {
            throw new NotFoundHttpException('机芯不存在');
        }

        $cacheItem->set($movement);
        $cacheItem->expiresAfter(self::CACHE_TTL);
        $this->cache->save($cacheItem);

        return $movement;
    }

    public function findByCode(string $code): ?Movement
    {
        $cacheKey = 'mv_code_' . md5($code);
        $cacheItem = $this->cache->getItem($cacheKey);
        if ($cacheItem->isHit()) {
            $mid = (int)$cacheItem->get();
            if ($mid > 0) {
                return $this->get($mid);
            }
            return null;
        }

        $movement = $this->movementRepo->findOneBy(['code' => $code]);
        $cacheItem->set((string)($movement?->getId() ?? 0));
        $cacheItem->expiresAfter(self::CACHE_TTL);
        $this->cache->save($cacheItem);

        return $movement;
    }

    public function brands(): array
    {
        $cacheKey = 'mv_brands';
        $cacheItem = $this->cache->getItem($cacheKey);
        if ($cacheItem->isHit()) {
            return $cacheItem->get();
        }

        $rows = $this->movementRepo->createQueryBuilder('m')
            ->select('m.brand, COUNT(m.id) AS cnt')
            ->groupBy('m.brand')
            ->orderBy('m.brand', 'ASC')
            ->getQuery()
            ->getResult();

        $brands = array_map(fn($r) => ['brand' => $r['brand'], 'count' => (int)$r['cnt']], $rows);

        $cacheItem->set($brands);
        $cacheItem->expiresAfter(self::CACHE_TTL + 1800);
        $this->cache->save($cacheItem);

        return $brands;
    }

    public function seedIfEmpty(): int
    {
        $count = $this->movementRepo->createQueryBuilder('m')
            ->select('COUNT(m.id)')
            ->getQuery()
            ->getSingleScalarResult();

        if ($count > 0) {
            return 0;
        }

        $seedData = $this->getSeedMovements();
        $created = 0;

        foreach ($seedData as $m) {
            $movement = new Movement();
            $movement->setCode($m['code']);
            $movement->setBrand($m['brand']);
            $movement->setCommonName($m['commonName'] ?? $m['code']);
            $movement->setFamily($m['family'] ?? '');
            $movement->setType($m['type'] ?? Movement::TYPE_AUTOMATIC);
            $movement->setJewels($m['jewels'] ?? 25);
            $movement->setStandardFrequency($m['freq'] ?? 28800);
            $movement->setStandardAmplitudeMin($m['ampMin'] ?? 260);
            $movement->setStandardAmplitudeMax($m['ampMax'] ?? 310);
            $movement->setStandardRateMin($m['rateMin'] ?? -6);
            $movement->setStandardRateMax($m['rateMax'] ?? 4);
            $movement->setBeatErrorMax($m['beatErr'] ?? 0.5);
            $movement->setStandardPowerReserveHours($m['pr'] ?? 42);
            $movement->setStandardLaborHours($m['labor'] ?? 4.5);
            $movement->setWaterResistanceRating($m['wr'] ?? '5 ATM');
            $movement->setDescription($m['desc'] ?? '');
            $movement->setServiceSteps($m['steps'] ?? [
                '外观检查与拍照记录',
                '机芯拆解',
                '零件超声波清洗',
                '逐件检查磨损情况',
                '机芯装配与润滑',
                '五方位调校',
                '防水测试',
                '24小时天文台标准走时测试'
            ]);
            $movement->setCommonFaults($m['faults'] ?? []);
            $movement->setRecommendedParts($m['parts'] ?? []);

            $this->em->persist($movement);
            $created++;
        }

        $this->em->flush();
        $this->cache->clear();
        $this->logger->info('Movement knowledge base seeded', ['count' => $created]);

        return $created;
    }

    private function groupByBrand(array $movements): array
    {
        $map = [];
        foreach ($movements as $m) {
            $brand = $m->getBrand() ?? '其他';
            if (!isset($map[$brand])) {
                $map[$brand] = [];
            }
            $map[$brand][] = $m;
        }
        return $map;
    }

    private function getSeedMovements(): array
    {
        return [
            ['brand' => 'Rolex', 'code' => '3135', 'commonName' => 'Cal.3135 恒动机芯', 'family' => '31xx', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 48, 'labor' => 5.0, 'wr' => '10 ATM',
                'desc' => '劳力士经典自动机芯，蓝铌游丝，Parachrom擒纵，DATEJUST与SUBMARINER主力机芯',
                'steps' => ['防水圈更换', '蓝铌游丝检查', '自动上链效率检测', 'COSC标准调校'],
                'faults' => ['自动陀轴承磨损', '日历跳历机构磨损', '擒纵叉宝石老化'],
                'parts' => ['主发条盒组件', '自动陀轴承', '蓝铌游丝', '日历轮']
            ],
            ['brand' => 'Rolex', 'code' => '3235', 'commonName' => 'Cal.3235 新一代恒动', 'family' => '32xx', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 70, 'labor' => 5.5, 'wr' => '10 ATM',
                'desc' => '3135升级款，Chronergy擒纵，70小时动力储备',
                'steps' => ['Chronergy擒纵检查', '70小时动力测试', 'COSC五方位调校'],
                'faults' => ['Chronergy擒纵机构调校', '发条盒润滑问题'],
                'parts' => ['Chronergy擒纵叉', '新发条盒', '自动轮']
            ],
            ['brand' => 'Rolex', 'code' => '4130', 'commonName' => 'Cal.4130 计时机芯', 'family' => '41xx', 'jewels' => 44, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 72, 'labor' => 7.5, 'wr' => '10 ATM',
                'desc' => '迪通拿专属计时机芯，垂直耦合+导柱轮，精密计时旗舰',
                'steps' => ['计时功能测试', '导柱轮检查', '垂直离合器调校', '零点对齐'],
                'faults' => ['计时机芯耦合问题', '导柱轮磨损', '计时秒针零点偏移'],
                'parts' => ['导柱轮', '垂直离合器', '计时凸轮']
            ],
            ['brand' => 'Omega', 'code' => '8500', 'commonName' => 'Cal.8500 同轴擒纵', 'family' => '85xx', 'jewels' => 39, 'freq' => 25200, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => -4, 'rateMax' => 4, 'beatErr' => 0.3, 'pr' => 60, 'labor' => 5.5, 'wr' => '15 ATM',
                'desc' => '欧米茄同轴擒纵系列旗舰，硅游丝，Master Chronometer认证',
                'steps' => ['同轴擒纵检查', '硅游丝完整性检查', 'Master Chronometer认证调校', '防磁测试'],
                'faults' => ['同轴擒纵润滑问题', '硅游丝安装要求高'],
                'parts' => ['同轴擒纵组件', '硅游丝', '双发条盒']
            ],
            ['brand' => 'Omega', 'code' => '8900', 'commonName' => 'Cal.8900 METAS认证', 'family' => '85xx', 'jewels' => 39, 'freq' => 25200, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => 0, 'rateMax' => 5, 'beatErr' => 0.3, 'pr' => 60, 'labor' => 6.0, 'wr' => '15 ATM',
                'desc' => '8500升级版，通过METAS 8项认证，15000高斯防磁',
                'steps' => ['METAS标准调校', '15000高斯防磁验证', '6方位+温度循环测试'],
                'faults' => ['同轴擒纵油干问题'],
                'parts' => ['同轴擒纵叉', '双发条盒组件']
            ],
            ['brand' => 'Omega', 'code' => '1861', 'commonName' => 'Cal.1861 登月机芯', 'family' => '18xx', 'jewels' => 18, 'freq' => 21600, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -6, 'rateMax' => 6, 'beatErr' => 0.6, 'pr' => 48, 'labor' => 5.0, 'wr' => '5 ATM',
                'desc' => 'Lemania 1873衍生，超霸登月表使用，凸轮控制计时机芯',
                'steps' => ['凸轮清理与润滑', '计时功能测试', '水平离合器调校'],
                'faults' => ['凸轮磨损', '水平离合器油干'],
                'parts' => ['凸轮组件', '计时齿轮组', '发条']
            ],
            ['brand' => 'ETA', 'code' => '2824-2', 'commonName' => 'ETA 2824-2 自动三针', 'family' => '28xx', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -12, 'rateMax' => 12, 'beatErr' => 0.6, 'pr' => 42, 'labor' => 3.5, 'wr' => '5 ATM',
                'desc' => '瑞士最量产的自动机芯之一，入门级瑞士表标配，可升级顶级调校',
                'steps' => ['标准清洗装配', '摆轮平衡调校', 'incabloc避震检查'],
                'faults' => ['自动上链效率下降', '摆轮游丝变形', '柄头防水圈老化'],
                'parts' => ['ETA 2824主发条', '自动换向轮', 'Incabloc避震簧', '游丝外桩环']
            ],
            ['brand' => 'ETA', 'code' => '2836-2', 'commonName' => 'ETA 2836-2 自动双历', 'family' => '28xx', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -12, 'rateMax' => 12, 'beatErr' => 0.6, 'pr' => 40, 'labor' => 4.0, 'wr' => '5 ATM',
                'desc' => '2824-2加星期日历版，海鸥、杭州仿造对象',
                'steps' => ['标准清洗装配', '历机构调校', '跳历时间检查'],
                'faults' => ['星期/日历跳不准', '历机构磨损'],
                'parts' => ['日历轮组件', '星期轮组件', '快拨凸轮']
            ],
            ['brand' => 'ETA', 'code' => '7750', 'commonName' => 'ETA 7750 自动计时', 'family' => '77xx', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 310, 'rateMin' => -12, 'rateMax' => 12, 'beatErr' => 0.7, 'pr' => 44, 'labor' => 5.5, 'wr' => '10 ATM',
                'desc' => 'ETA经典计时机芯，凸轮控制，万年历模块基础',
                'steps' => ['凸轮清理', '计时指针零点对齐', '水平离合器调校'],
                'faults' => ['凸轮磨损', '计时秒针跳秒', '离合器磨损'],
                'parts' => ['凸轮组件', '计时小齿轮', '水平离合器']
            ],
            ['brand' => 'Sellita', 'code' => 'SW200', 'commonName' => 'Sellita SW200-1', 'family' => 'SW200', 'jewels' => 26, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -12, 'rateMax' => 12, 'beatErr' => 0.6, 'pr' => 38, 'labor' => 3.5, 'wr' => '5 ATM',
                'desc' => '2824-2同等级替代，SW集团出品，性价比高',
                'steps' => ['标准清洗装配', '自动陀轴承检查'],
                'faults' => ['自动上链效率低', '摆轮轴尖磨损'],
                'parts' => ['自动陀轴承', '主发条']
            ],
            ['brand' => 'Sellita', 'code' => 'SW300', 'commonName' => 'Sellita SW300-1', 'family' => 'SW300', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -8, 'rateMax' => 8, 'beatErr' => 0.5, 'pr' => 42, 'labor' => 3.8, 'wr' => '5 ATM',
                'desc' => 'ETA 2892-A2替代款，薄型机芯',
                'steps' => ['薄型机芯装配', '齿轮间隙检查'],
                'faults' => ['自动轮磨损', '主发条力矩不足'],
                'parts' => ['自动轮组', '主发条盒']
            ],
            ['brand' => 'Seiko', 'code' => '6R35', 'commonName' => 'Seiko 6R35 自动', 'family' => '6Rxx', 'jewels' => 24, 'freq' => 21600, 'ampMin' => 250, 'ampMax' => 310, 'rateMin' => -15, 'rateMax' => 25, 'beatErr' => 0.8, 'pr' => 70, 'labor' => 3.0, 'wr' => '10 ATM',
                'desc' => '精工中端自动机芯，70小时动力，Presage/Prospex主力',
                'steps' => ['精工标准保养', '魔术杠杆上链检查'],
                'faults' => ['魔术杠杆磨损', '手动上链异响'],
                'parts' => ['魔术杠杆组件', '主发条', '大钢轮']
            ],
            ['brand' => 'Seiko', 'code' => '9SA5', 'commonName' => 'Grand Seiko 9SA5', 'family' => '9Sxx', 'jewels' => 80, 'freq' => 36000, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 5, 'beatErr' => 0.2, 'pr' => 80, 'labor' => 7.0, 'wr' => '10 ATM',
                'desc' => '大精工旗舰自动机芯，36000高频，双脉冲擒纵，80小时动力',
                'steps' => ['GS认证调校', '双脉冲擒纵检查', '80H动力测试'],
                'faults' => ['高频调校精度要求高'],
                'parts' => ['双脉冲擒纵轮', '双发条盒']
            ],
            ['brand' => 'Miyota', 'code' => '9015', 'commonName' => 'Miyota 9015 自动', 'family' => '90xx', 'jewels' => 24, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 310, 'rateMin' => -10, 'rateMax' => 30, 'beatErr' => 0.6, 'pr' => 42, 'labor' => 2.8, 'wr' => '5 ATM',
                'desc' => '日本西铁城出品，超薄自动机芯，国产表大量使用',
                'steps' => ['薄型机芯装配', '轴承润滑'],
                'faults' => ['自动陀异响', '摆轮轴承磨损'],
                'parts' => ['自动陀轴承', '主发条']
            ],
            ['brand' => 'IWC', 'code' => '79320', 'commonName' => 'IWC 79320', 'family' => '79xx', 'jewels' => 29, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -8, 'rateMax' => 8, 'beatErr' => 0.6, 'pr' => 44, 'labor' => 6.0, 'wr' => '6 ATM',
                'desc' => 'IWC 葡计主力机芯，ETA 7750精改版本',
                'steps' => ['精改7750保养', '导柱轮检查', 'IWC标准调校'],
                'faults' => ['凸轮磨损', '计时机构耦合问题'],
                'parts' => ['精修凸轮组件', '导柱轮']
            ],
            ['brand' => 'Cartier', 'code' => '1847 MC', 'commonName' => 'Cartier 1847 MC', 'family' => '18xx', 'jewels' => 23, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -5, 'rateMax' => 5, 'beatErr' => 0.5, 'pr' => 42, 'labor' => 5.0, 'wr' => '3 ATM',
                'desc' => '卡地亚山度士、坦克系列主力自产机芯，42H动力',
                'steps' => ['卡地亚认证调校', '双向上链系统检查'],
                'faults' => ['自动陀轴承', '上链效率'],
                'parts' => ['自动陀轴承', '发条盒']
            ],
            ['brand' => 'Patek Philippe', 'code' => '324 S C', 'commonName' => 'Cal.324 SC', 'family' => '324', 'jewels' => 29, 'freq' => 28800, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 45, 'labor' => 8.0, 'wr' => '6 ATM',
                'desc' => '百达翡丽鹦鹉螺5711/5712核心，Spiromax®游丝，Gyromax®摆轮',
                'steps' => ['PP认证调校', 'Spiromax检查', 'Gyromax摆轮八方位调校'],
                'faults' => ['自动陀轴承磨损', '上链系统异响'],
                'parts' => ['Spiromax硅游丝', 'Gyromax摆轮', '自动轮组']
            ],
            ['brand' => 'Audemars Piguet', 'code' => '3120', 'commonName' => 'Cal.3120', 'family' => '31xx', 'jewels' => 40, 'freq' => 21600, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.3, 'pr' => 65, 'labor' => 9.0, 'wr' => '5 ATM',
                'desc' => '皇家橡树15400/15500旗舰，65小时动力，AP顶级打磨',
                'steps' => ['AP顶级调校', '65H动力储备测试', '双发条盒检查'],
                'faults' => ['自动上链系统问题', '高频摆轮调校'],
                'parts' => ['双发条盒组件', '自动陀轴承', '摆轮组件']
            ],
        ];
    }
}
