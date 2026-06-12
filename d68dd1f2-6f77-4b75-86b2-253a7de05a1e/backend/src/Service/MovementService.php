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
                    'm.caliber LIKE :kw',
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
            $qb->andWhere('m.jewelCount >= :jf')->setParameter('jf', (int)$filters['jewelsFrom']);
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
            $movement->setJewelCount($m['jewels'] ?? 25);
            $movement->setFrequency($m['freq'] ?? 28800);
            $movement->setAmplitudeMin($m['ampMin'] ?? 260);
            $movement->setAmplitudeMax($m['ampMax'] ?? 310);
            $movement->setRateMin($m['rateMin'] ?? -6);
            $movement->setRateMax($m['rateMax'] ?? 4);
            $movement->setBeatErrorMax($m['beatErr'] ?? 0.5);
            $movement->setPowerReserveHours($m['pr'] ?? 42);
            $movement->setStandardAmplitude(sprintf('%d-%d', $m['ampMin'] ?? 260, $m['ampMax'] ?? 310));
            $movement->setStandardRate(sprintf('%+d to %+d', $m['rateMin'] ?? -6, $m['rateMax'] ?? 4));
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
            $movement->setCommonFailures($m['faults'] ?? []);
            $movement->setRecommendedParts($m['parts'] ?? []);

            $this->em->persist($movement);
            $created++;
        }

        $this->em->flush();
        $this->deleteByPrefix('mv_');
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

    private function deleteByPrefix(string $prefix): void
    {
        try {
            if ($this->cache instanceof \Symfony\Component\Cache\Adapter\RedisAdapter) {
                $redis = $this->cache->getRedis();
                $namespace = $this->cache->getNamespace();
                $pattern = $namespace . ':' . $prefix . '*';
                $it = null;
                do {
                    $keys = $redis->scan($it, $pattern, 100);
                    if ($keys) {
                        $redis->del($keys);
                    }
                } while ($it > 0);
                return;
            }
        } catch (\Throwable $e) {
            $this->logger->warning('Failed to delete cache by prefix', [
                'prefix' => $prefix,
                'error' => $e->getMessage(),
            ]);
        }

        $allKeys = [];
        try {
            $items = $this->cache->getItems();
            foreach ($items as $key => $item) {
                if (str_starts_with($key, $prefix)) {
                    $allKeys[] = $key;
                }
            }
            if (!empty($allKeys)) {
                $this->cache->deleteItems($allKeys);
            }
        } catch (\Throwable $e) {
            $this->logger->warning('Cache fallback deletion failed', [
                'prefix' => $prefix,
                'error' => $e->getMessage(),
            ]);
        }
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
            // ===== Rolex 更多款 =====
            ['brand' => 'Rolex', 'code' => '3130', 'commonName' => 'Cal.3130 无历恒动', 'family' => '31xx', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 48, 'labor' => 4.5, 'wr' => '10 ATM',
                'desc' => '3135无历版本，Explorer/Submariner无历款使用',
                'steps' => ['蓝铌游丝检查', 'Parachrom擒纵检查', 'COSC调校'],
                'faults' => ['自动陀轴承磨损', '摆轮间隙问题'],
                'parts' => ['蓝铌游丝', '自动陀轴承', '摆轮组件']
            ],
            ['brand' => 'Rolex', 'code' => '3155', 'commonName' => 'Cal.3155 双历', 'family' => '31xx', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 48, 'labor' => 5.5, 'wr' => '10 ATM',
                'desc' => 'Day-Date星期日历型专属，3135加星期模块',
                'steps' => ['星期历机构检查', '快拨系统调校', 'COSC标准'],
                'faults' => ['星期历跳历不准', '快拨凸轮磨损'],
                'parts' => ['星期轮组件', '日历快拨凸轮']
            ],
            ['brand' => 'Rolex', 'code' => '3186', 'commonName' => 'Cal.3186 GMT', 'family' => '31xx', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 48, 'labor' => 5.5, 'wr' => '10 ATM',
                'desc' => 'GMT-Master II两地时机芯，Cerachrom陶瓷字圈',
                'steps' => ['GMT指针调校', '24小时轮检查', 'COSC标准'],
                'faults' => ['GMT轮系问题', '独立时针调校机构'],
                'parts' => ['GMT 24小时轮', '时针独立轮系']
            ],
            ['brand' => 'Rolex', 'code' => '3255', 'commonName' => 'Cal.3255 星期日历', 'family' => '32xx', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 70, 'labor' => 6.0, 'wr' => '10 ATM',
                'desc' => 'Day-Date 40新机芯，Chronergy擒纵70小时动力',
                'steps' => ['Chronergy擒纵检查', '星期历机构测试', '70H动力测试'],
                'faults' => ['Chronergy擒纵润滑', '发条盒问题'],
                'parts' => ['Chronergy擒纵叉', '双发条盒']
            ],
            ['brand' => 'Rolex', 'code' => '3285', 'commonName' => 'Cal.3285 GMT新', 'family' => '32xx', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 70, 'labor' => 6.0, 'wr' => '10 ATM',
                'desc' => 'GMT-Master II新机芯，70小时动力，Chronergy擒纵',
                'steps' => ['Chronergy擒纵检查', 'GMT双时区功能测试'],
                'faults' => ['GMT轮系', '独立快拨时针'],
                'parts' => ['Chronergy擒纵', 'GMT轮组']
            ],
            ['brand' => 'Rolex', 'code' => '4161', 'commonName' => 'Cal.4161 游艇名仕II', 'family' => '41xx', 'jewels' => 360, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 72, 'labor' => 9.0, 'wr' => '10 ATM',
                'desc' => 'Yacht-Master II帆船赛倒计时计时机芯，Ring Command',
                'steps' => ['倒计时功能测试', 'Ring Command调校', '导柱轮检查'],
                'faults' => ['倒计时功能复杂', '机械记忆轮系'],
                'parts' => ['导柱轮', '记忆轮组', 'Ring Command组件']
            ],
            ['brand' => 'Rolex', 'code' => '2235', 'commonName' => 'Cal.2235 女款恒动', 'family' => '22xx', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 300, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.25, 'pr' => 42, 'labor' => 4.5, 'wr' => '10 ATM',
                'desc' => '女款Datejust 28/31机芯，小尺寸高精度',
                'steps' => ['小型机芯精密装配', 'COSC标准调校'],
                'faults' => ['小尺寸零件精密问题', '自动上链效率'],
                'parts' => ['小型发条盒', '微型自动轮']
            ],
            // ===== Omega 更多款 =====
            ['brand' => 'Omega', 'code' => '8800', 'commonName' => 'Cal.8800 同轴至臻天文台', 'family' => '85xx', 'jewels' => 35, 'freq' => 25200, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => 0, 'rateMax' => 5, 'beatErr' => 0.3, 'pr' => 55, 'labor' => 5.5, 'wr' => '15 ATM',
                'desc' => '海马系列主力，METAS认证，15000高斯防磁',
                'steps' => ['同轴擒纵检查', 'METAS防磁测试', '5方位调校'],
                'faults' => ['同轴擒纵油干', '防磁组件检查'],
                'parts' => ['同轴擒纵叉', '硅游丝', '双发条盒']
            ],
            ['brand' => 'Omega', 'code' => '8906', 'commonName' => 'Cal.8906 GMT', 'family' => '85xx', 'jewels' => 39, 'freq' => 25200, 'ampMin' => 280, 'ampMax' => 310, 'rateMin' => 0, 'rateMax' => 5, 'beatErr' => 0.3, 'pr' => 60, 'labor' => 6.5, 'wr' => '15 ATM',
                'desc' => '海马AT150 GMT，双时区，METAS认证',
                'steps' => ['GMT轮系检查', '双时区测试', 'METAS认证'],
                'faults' => ['GMT快拨机构', '时区调校'],
                'parts' => ['GMT轮组', '双发条盒']
            ],
            ['brand' => 'Omega', 'code' => '9300', 'commonName' => 'Cal.9300 同轴计时', 'family' => '93xx', 'jewels' => 54, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.3, 'pr' => 60, 'labor' => 7.5, 'wr' => '10 ATM',
                'desc' => '超霸/海马同轴计时机芯，导柱轮+双发条盒',
                'steps' => ['导柱轮检查', '同轴擒纵测试', '计时功能调校'],
                'faults' => ['计时机芯复杂', '导柱轮磨损'],
                'parts' => ['导柱轮', '同轴擒纵组件', '计时离合器']
            ],
            ['brand' => 'Omega', 'code' => '9900', 'commonName' => 'Cal.9900 METAS计时', 'family' => '99xx', 'jewels' => 54, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => 0, 'rateMax' => 5, 'beatErr' => 0.3, 'pr' => 60, 'labor' => 8.0, 'wr' => '10 ATM',
                'desc' => '9300升级版，METAS认证，15000高斯防磁',
                'steps' => ['METAS防磁测试', '计时功能检查', '8项认证测试'],
                'faults' => ['防磁组件', '高频计时调校'],
                'parts' => ['导柱轮', '同轴擒纵', '防磁组件']
            ],
            ['brand' => 'Omega', 'code' => '2500', 'commonName' => 'Cal.2500 同轴擒纵初代', 'family' => '25xx', 'jewels' => 27, 'freq' => 25200, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -6, 'rateMax' => 6, 'beatErr' => 0.5, 'pr' => 44, 'labor' => 4.5, 'wr' => '5 ATM',
                'desc' => '首款量产同轴擒纵机芯，ETA2892改同轴',
                'steps' => ['第一代同轴检查', '擒纵叉磨损评估', '必要时升级'],
                'faults' => ['初代同轴设计缺陷', '擒纵叉磨损严重', '偷停问题'],
                'parts' => ['同轴擒纵叉升级件', '轮系全套清洗']
            ],
            ['brand' => 'Omega', 'code' => '3330', 'commonName' => 'Cal.3330 自动计时', 'family' => '33xx', 'jewels' => 37, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -8, 'rateMax' => 8, 'beatErr' => 0.6, 'pr' => 52, 'labor' => 6.0, 'wr' => '10 ATM',
                'desc' => 'ETA7753改同轴擒纵，超霸入门款使用',
                'steps' => ['同轴转换检查', '凸轮清理', '计时功能测试'],
                'faults' => ['凸轮磨损', '7750经典问题'],
                'parts' => ['凸轮组件', '计时轮']
            ],
            // ===== ETA 更多款 =====
            ['brand' => 'ETA', 'code' => '2892-A2', 'commonName' => 'ETA 2892-A2 高端自动', 'family' => '28xx', 'jewels' => 21, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -6, 'rateMax' => 6, 'beatErr' => 0.5, 'pr' => 42, 'labor' => 4.0, 'wr' => '5 ATM',
                'desc' => 'ETA高端薄型自动机芯，浪琴、名士、豪利时大量使用',
                'steps' => ['薄型齿轮间隙检查', '双向上链维护'],
                'faults' => ['上链齿轮磨损', '自动陀异响'],
                'parts' => ['自动换向轮', '上链齿轮']
            ],
            ['brand' => 'ETA', 'code' => '2804-2', 'commonName' => 'ETA 2804-2 手卷三针', 'family' => '28xx', 'jewels' => 17, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -12, 'rateMax' => 12, 'beatErr' => 0.7, 'pr' => 42, 'labor' => 2.5, 'wr' => '3 ATM',
                'desc' => '2824手卷版，无自动结构，超薄设计',
                'steps' => ['手卷上链机构检查', '薄型装配'],
                'faults' => ['钢轮磨损', '大钢轮棘轮'],
                'parts' => ['大钢轮', '棘爪']
            ],
            ['brand' => 'ETA', 'code' => '7751', 'commonName' => 'ETA 7751 月相加计时', 'family' => '77xx', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -12, 'rateMax' => 12, 'beatErr' => 0.7, 'pr' => 42, 'labor' => 6.5, 'wr' => '5 ATM',
                'desc' => '7750加月相、星期、日历模块，复杂计时多功能',
                'steps' => ['月相模块调校', '历机构检查', '计时测试'],
                'faults' => ['月相齿轮磨损', '多历调校复杂'],
                'parts' => ['月相轮', '日历模块']
            ],
            ['brand' => 'ETA', 'code' => '7753', 'commonName' => 'ETA 7753 计时', 'family' => '77xx', 'jewels' => 27, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -12, 'rateMax' => 12, 'beatErr' => 0.7, 'pr' => 42, 'labor' => 5.5, 'wr' => '10 ATM',
                'desc' => '7750改进版，30分钟累加器位置变化，双历快拨',
                'steps' => ['凸轮系统检查', '双历快拨测试'],
                'faults' => ['凸轮磨损', '计时归零不准'],
                'parts' => ['凸轮组件', '计时锤']
            ],
            ['brand' => 'ETA', 'code' => '6497-1', 'commonName' => 'ETA 6497-1 怀表机芯改', 'family' => '64xx', 'jewels' => 17, 'freq' => 18000, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -10, 'rateMax' => 10, 'beatErr' => 1.0, 'pr' => 46, 'labor' => 3.0, 'wr' => '3 ATM',
                'desc' => 'Unitas 6497经典怀表机芯，沛纳海大量使用，18000摆频',
                'steps' => ['怀表改腕表调整', '大摆轮平衡调校'],
                'faults' => ['低摆频精度', '鹅颈微调装置'],
                'parts' => ['大摆轮', '鹅颈微调', '游丝']
            ],
            ['brand' => 'ETA', 'code' => '6498-1', 'commonName' => 'ETA 6498-1 大摆轮', 'family' => '64xx', 'jewels' => 17, 'freq' => 18000, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -10, 'rateMax' => 10, 'beatErr' => 1.0, 'pr' => 46, 'labor' => 3.0, 'wr' => '3 ATM',
                'desc' => '6497变种，大摆轮，沛纳海005等使用',
                'steps' => ['大摆轮平衡', '螺丝摆轮调校'],
                'faults' => ['18000摆频精度', '螺丝摆轮平衡'],
                'parts' => ['螺丝摆轮', '游丝']
            ],
            ['brand' => 'ETA', 'code' => 'A07.111', 'commonName' => 'ETA A07.111 改进7750', 'family' => '77xx', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -8, 'rateMax' => 8, 'beatErr' => 0.6, 'pr' => 48, 'labor' => 5.5, 'wr' => '10 ATM',
                'desc' => '7750改进版，更高精度标准，天梭、雪铁纳使用',
                'steps' => ['A07标准调校', '更高精度出厂测试'],
                'faults' => ['经典7750问题', '凸轮磨损'],
                'parts' => ['改进型凸轮', '精调摆轮']
            ],
            // ===== Sellita 更多款 =====
            ['brand' => 'Sellita', 'code' => 'SW500', 'commonName' => 'Sellita SW500 自动计时', 'family' => 'SW500', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -12, 'rateMax' => 12, 'beatErr' => 0.7, 'pr' => 42, 'labor' => 5.5, 'wr' => '10 ATM',
                'desc' => 'ETA7750替代款，凸轮控制计时',
                'steps' => ['凸轮清理', '计时测试'],
                'faults' => ['凸轮磨损', '计时跳秒'],
                'parts' => ['凸轮组件', '计时锤']
            ],
            ['brand' => 'Sellita', 'code' => 'SW510', 'commonName' => 'Sellita SW510 双历计时', 'family' => 'SW500', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -12, 'rateMax' => 12, 'beatErr' => 0.7, 'pr' => 42, 'labor' => 6.0, 'wr' => '10 ATM',
                'desc' => 'SW500加星期日历，同7751功能',
                'steps' => ['双历模块调校', '计时功能测试'],
                'faults' => ['历机构磨损', '凸轮问题'],
                'parts' => ['日历轮', '凸轮']
            ],
            ['brand' => 'Sellita', 'code' => 'SW400', 'commonName' => 'Sellita SW400-1', 'family' => 'SW400', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -8, 'rateMax' => 8, 'beatErr' => 0.6, 'pr' => 44, 'labor' => 4.0, 'wr' => '5 ATM',
                'desc' => 'ETA2834-2替代款，自动双历',
                'steps' => ['双历调校', '自动上链测试'],
                'faults' => ['历机构问题', '自动轮磨损'],
                'parts' => ['日历轮', '自动轮组']
            ],
            ['brand' => 'Sellita', 'code' => 'SW600', 'commonName' => 'Sellita SW600 计时机芯', 'family' => 'SW600', 'jewels' => 30, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -8, 'rateMax' => 8, 'beatErr' => 0.6, 'pr' => 42, 'labor' => 5.5, 'wr' => '10 ATM',
                'desc' => '导柱轮计时机芯，7750升级路线',
                'steps' => ['导柱轮检查', '计时功能校准'],
                'faults' => ['导柱轮磨损', '离合器问题'],
                'parts' => ['导柱轮', '垂直离合器']
            ],
            // ===== Seiko 更多款 =====
            ['brand' => 'Seiko', 'code' => '7S26', 'commonName' => 'Seiko 7S26 自动入门', 'family' => '7Sxx', 'jewels' => 21, 'freq' => 21600, 'ampMin' => 240, 'ampMax' => 300, 'rateMin' => -20, 'rateMax' => 40, 'beatErr' => 1.0, 'pr' => 40, 'labor' => 2.0, 'wr' => '10 ATM',
                'desc' => '精工5号经典入门机芯，性价比高，非手动上链',
                'steps' => ['7S标准保养', '自动陀轴承检查'],
                'faults' => ['精度范围大±20~+40', '不能停秒', '自动上链效率'],
                'parts' => ['自动陀轴承', '主发条']
            ],
            ['brand' => 'Seiko', 'code' => '7S36', 'commonName' => 'Seiko 7S36 23钻', 'family' => '7Sxx', 'jewels' => 23, 'freq' => 21600, 'ampMin' => 240, 'ampMax' => 300, 'rateMin' => -20, 'rateMax' => 40, 'beatErr' => 1.0, 'pr' => 40, 'labor' => 2.2, 'wr' => '10 ATM',
                'desc' => '7S26加2钻，避震升级，精工5号高配',
                'steps' => ['Diashock避震检查', '7S标准保养'],
                'faults' => ['精度偏低', '不能停秒调时'],
                'parts' => ['Diashock避震器', '主发条']
            ],
            ['brand' => 'Seiko', 'code' => '4R35', 'commonName' => 'Seiko 4R35 自动', 'family' => '4Rxx', 'jewels' => 24, 'freq' => 21600, 'ampMin' => 240, 'ampMax' => 300, 'rateMin' => -15, 'rateMax' => 25, 'beatErr' => 0.9, 'pr' => 40, 'labor' => 2.5, 'wr' => '10 ATM',
                'desc' => '7S升级款，支持手动上链+停秒，Presage入门',
                'steps' => ['手动上链测试', '停秒功能检查'],
                'faults' => ['手动上链异响', '4R新系统磨合'],
                'parts' => ['手动上链轮', '停秒杠杆']
            ],
            ['brand' => 'Seiko', 'code' => '4R36', 'commonName' => 'Seiko 4R36 双历自动', 'family' => '4Rxx', 'jewels' => 24, 'freq' => 21600, 'ampMin' => 240, 'ampMax' => 300, 'rateMin' => -15, 'rateMax' => 25, 'beatErr' => 0.9, 'pr' => 40, 'labor' => 2.8, 'wr' => '10 ATM',
                'desc' => '4R35加星期日历，精工5号新主力',
                'steps' => ['双历调校', '快拨测试'],
                'faults' => ['历机构跳不准', '星期轮'],
                'parts' => ['星期轮', '日历轮']
            ],
            ['brand' => 'Seiko', 'code' => '6R15', 'commonName' => 'Seiko 6R15 自动', 'family' => '6Rxx', 'jewels' => 23, 'freq' => 21600, 'ampMin' => 250, 'ampMax' => 310, 'rateMin' => -15, 'rateMax' => 25, 'beatErr' => 0.8, 'pr' => 50, 'labor' => 3.0, 'wr' => '10 ATM',
                'desc' => '精工中端机芯，Diafix避震，比4R更稳',
                'steps' => ['魔术杠杆检查', 'Diafix避震测试'],
                'faults' => ['魔术杠杆磨损', '手动上链'],
                'parts' => ['魔术杠杆', '主发条']
            ],
            ['brand' => 'Seiko', 'code' => '6R27', 'commonName' => 'Seiko 6R27 自动动显', 'family' => '6Rxx', 'jewels' => 29, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 310, 'rateMin' => -10, 'rateMax' => 15, 'beatErr' => 0.7, 'pr' => 45, 'labor' => 3.5, 'wr' => '10 ATM',
                'desc' => '6R高端款，28800摆频，动力储存显示',
                'steps' => ['动显模块调校', '28800摆频调校'],
                'faults' => ['动显机构', '动力显示不准'],
                'parts' => ['动显轮组', '发条盒']
            ],
            ['brand' => 'Seiko', 'code' => '8L35', 'commonName' => 'Grand Seiko 8L35', 'family' => '8Lxx', 'jewels' => 26, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 5, 'beatErr' => 0.3, 'pr' => 50, 'labor' => 5.0, 'wr' => '10 ATM',
                'desc' => 'GS自动基础机芯，手工调校，10秒/月精度',
                'steps' => ['GS认证调校', '手工装配打磨'],
                'faults' => ['高精度要求', '手工调校'],
                'parts' => ['MEMS游丝', '精调摆轮']
            ],
            ['brand' => 'Seiko', 'code' => '9R65', 'commonName' => 'Grand Seiko 9R65 Spring Drive', 'family' => '9Rxx', 'jewels' => 30, 'freq' => 32768, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -1, 'rateMax' => 1, 'beatErr' => 0.1, 'pr' => 72, 'labor' => 6.5, 'wr' => '10 ATM',
                'desc' => '精工Spring Drive，机械+石英融合，月差±15秒',
                'steps' => ['Spring Drive特殊保养', '电磁轮系检查', 'IC电路测试'],
                'faults' => ['电磁控制精度', 'IC电路故障', '特殊润滑要求'],
                'parts' => ['电磁线圈', 'IC模块', '特殊发条']
            ],
            // ===== Miyota 更多款 =====
            ['brand' => 'Miyota', 'code' => '8200', 'commonName' => 'Miyota 8200 自动', 'family' => '82xx', 'jewels' => 21, 'freq' => 21600, 'ampMin' => 240, 'ampMax' => 300, 'rateMin' => -20, 'rateMax' => 40, 'beatErr' => 1.0, 'pr' => 42, 'labor' => 2.0, 'wr' => '5 ATM',
                'desc' => '西铁城经典入门自动机芯，性价比高，国产表大量使用',
                'steps' => ['8200标准保养', '自动上链效率检查'],
                'faults' => ['精度偏低±15~+40', '单向自动上链', '钢轮异响'],
                'parts' => ['自动换向轮', '主发条', '钢轮']
            ],
            ['brand' => 'Miyota', 'code' => '8215', 'commonName' => 'Miyota 8215 无历自动', 'family' => '82xx', 'jewels' => 21, 'freq' => 21600, 'ampMin' => 240, 'ampMax' => 300, 'rateMin' => -20, 'rateMax' => 40, 'beatErr' => 1.0, 'pr' => 42, 'labor' => 1.8, 'wr' => '5 ATM',
                'desc' => '8200无历版本，结构更简单',
                'steps' => ['基础保养', '摆轮调校'],
                'faults' => ['精度低', '单向自动上链'],
                'parts' => ['主发条', '摆轮组件']
            ],
            ['brand' => 'Miyota', 'code' => '821A', 'commonName' => 'Miyota 821A 透底花纹夹板', 'family' => '82xx', 'jewels' => 21, 'freq' => 21600, 'ampMin' => 240, 'ampMax' => 300, 'rateMin' => -20, 'rateMax' => 40, 'beatErr' => 1.0, 'pr' => 42, 'labor' => 2.2, 'wr' => '5 ATM',
                'desc' => '8200升级，透底花纹夹板，外观更美',
                'steps' => ['8200标准保养', '花纹夹板清洁'],
                'faults' => ['精度偏低', '单向自动上链'],
                'parts' => ['自动上链组件']
            ],
            ['brand' => 'Miyota', 'code' => '9100', 'commonName' => 'Miyota 9100 自动多功能', 'family' => '90xx', 'jewels' => 26, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 310, 'rateMin' => -10, 'rateMax' => 30, 'beatErr' => 0.6, 'pr' => 42, 'labor' => 3.5, 'wr' => '5 ATM',
                'desc' => '9015加动显+能量显示，更高配',
                'steps' => ['动显模块调校', '90xx精度检查'],
                'faults' => ['动显机构', '自动陀异响'],
                'parts' => ['动显轮组', '自动陀轴承']
            ],
            ['brand' => 'Miyota', 'code' => 'JS15', 'commonName' => 'Miyota JS15 石英', 'type' => 'quartz', 'family' => 'JSxx', 'jewels' => 3, 'freq' => 32768, 'ampMin' => 0, 'ampMax' => 0, 'rateMin' => -0.5, 'rateMax' => 0.5, 'beatErr' => 0.0, 'pr' => 0, 'labor' => 0.8, 'wr' => '5 ATM',
                'desc' => '标准三针石英机芯，年差±20秒，电池寿命3年',
                'steps' => ['电池更换', '防水圈检查', '石英电路测试'],
                'faults' => ['电池耗尽', '线圈断路', '步进马达卡死'],
                'parts' => ['371电池', '线圈', '步进马达转子']
            ],
            ['brand' => 'Miyota', 'code' => '0S10', 'commonName' => 'Miyota 0S10 石英计时', 'type' => 'quartz', 'family' => '0Sxx', 'jewels' => 5, 'freq' => 32768, 'ampMin' => 0, 'ampMax' => 0, 'rateMin' => -0.5, 'rateMax' => 0.5, 'beatErr' => 0.0, 'pr' => 0, 'labor' => 1.2, 'wr' => '5 ATM',
                'desc' => '石英计时机芯，1/20秒计时，闹钟功能',
                'steps' => ['电池更换', '计时功能测试', '闹钟检查'],
                'faults' => ['IC电路', '马达线圈', '电池漏液'],
                'parts' => ['371电池', 'IC模块', '线圈']
            ],
            // ===== Jaeger-LeCoultre 积家 =====
            ['brand' => 'JLC', 'code' => '899/1', 'commonName' => 'Cal.899/1 自动', 'family' => '899', 'jewels' => 30, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.3, 'pr' => 43, 'labor' => 7.0, 'wr' => '5 ATM',
                'desc' => '积家自动基础机芯，Master Control系列主力，1000小时测试',
                'steps' => ['1000小时测试标准调校', '陶瓷轴承检查', '双向上链测试'],
                'faults' => ['陶瓷自动陀轴承', '摆轮游丝安装要求高'],
                'parts' => ['陶瓷轴承自动陀', '双发条盒', '硅游丝']
            ],
            ['brand' => 'JLC', 'code' => '770', 'commonName' => 'Cal.770 手卷两针', 'family' => '770', 'jewels' => 19, 'freq' => 21600, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -5, 'rateMax' => 5, 'beatErr' => 0.5, 'pr' => 40, 'labor' => 4.0, 'wr' => '3 ATM',
                'desc' => '积家超薄手卷机芯，Reverso翻转表使用，4.1mm厚度',
                'steps' => ['超薄机芯装配', '齿轮间隙检查', '两针对齐校准'],
                'faults' => ['超薄零件易损', '摆轮轴尖脆弱'],
                'parts' => ['超薄发条盒', '微型摆轮轴']
            ],
            ['brand' => 'JLC', 'code' => '938', 'commonName' => 'Cal.938 地理学家', 'family' => '938', 'jewels' => 34, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.3, 'pr' => 43, 'labor' => 8.5, 'wr' => '5 ATM',
                'desc' => '地理学家大师机芯，双时区+24时区城市显示',
                'steps' => ['时区调校', '双时区同步测试', '城市盘检查'],
                'faults' => ['时区转换机构', '城市盘校准'],
                'parts' => ['时区轮组', '城市显示盘', '双发条盒']
            ],
            ['brand' => 'JLC', 'code' => '978', 'commonName' => 'Cal.978 北宸三针', 'family' => '978', 'jewels' => 27, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.3, 'pr' => 70, 'labor' => 7.5, 'wr' => '10 ATM',
                'desc' => '积家北宸系列，70小时动力，矽擒纵',
                'steps' => ['矽擒纵检查', '70H动力测试', '1000小时认证'],
                'faults' => ['矽擒纵调校', '双发条盒同步'],
                'parts' => ['矽擒纵叉', '双发条盒']
            ],
            ['brand' => 'JLC', 'code' => '751D', 'commonName' => 'Cal.751D 自动计时', 'family' => '751', 'jewels' => 37, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.3, 'pr' => 65, 'labor' => 9.0, 'wr' => '5 ATM',
                'desc' => '导柱轮计时机芯，65小时动力，飞返功能',
                'steps' => ['导柱轮飞返测试', '计时归零调校', '65H动力'],
                'faults' => ['飞返机构磨损', '导柱轮'],
                'parts' => ['飞返锤', '导柱轮', '垂直离合器']
            ],
            // ===== Breitling 百年灵 =====
            ['brand' => 'Breitling', 'code' => 'B01', 'commonName' => 'Breitling B01 自产计时', 'family' => 'B01', 'jewels' => 47, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -4, 'rateMax' => 6, 'beatErr' => 0.3, 'pr' => 70, 'labor' => 8.0, 'wr' => '10 ATM',
                'desc' => '百年灵首款自产计时机芯，导柱轮+垂直离合，70小时动力',
                'steps' => ['导柱轮检查', '垂直离合测试', 'COSC认证调校'],
                'faults' => ['垂直离合器', '导柱轮磨损', '70小时动力储备'],
                'parts' => ['导柱轮', '垂直离合器', '双发条盒']
            ],
            ['brand' => 'Breitling', 'code' => 'B20', 'commonName' => 'Breitling B20 自动', 'family' => 'B20', 'jewels' => 28, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -4, 'rateMax' => 6, 'beatErr' => 0.3, 'pr' => 70, 'labor' => 6.0, 'wr' => '20 ATM',
                'desc' => '百年灵自动基础机芯，帝舵MT5612合作款，COSC认证',
                'steps' => ['COSC标准调校', '硅游丝检查', '70H动力测试'],
                'faults' => ['硅游丝安装', '自动上链效率'],
                'parts' => ['硅游丝', '大钢轮', '双发条盒']
            ],
            ['brand' => 'Breitling', 'code' => '7750', 'commonName' => 'Breitling 7750 精改计时', 'family' => '77xx', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -6, 'rateMax' => 8, 'beatErr' => 0.6, 'pr' => 42, 'labor' => 6.5, 'wr' => '10 ATM',
                'desc' => 'ETA7750百年灵精改版，航空计时系列经典',
                'steps' => ['精改7750保养', '凸轮系统调校', '航空表标准'],
                'faults' => ['经典7750凸轮磨损', '滑尺联动机构'],
                'parts' => ['精修凸轮', '滑尺齿轮']
            ],
            // ===== TAG Heuer 泰格豪雅 =====
            ['brand' => 'TAG', 'code' => 'Heuer 02', 'commonName' => 'Heuer 02 自产计时', 'family' => '02', 'jewels' => 33, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -4, 'rateMax' => 6, 'beatErr' => 0.4, 'pr' => 80, 'labor' => 7.5, 'wr' => '10 ATM',
                'desc' => '泰格豪雅自产计时机芯，80小时动力，柱轮+垂直离合',
                'steps' => ['柱轮检查', '80H动力测试', '垂直离合调校'],
                'faults' => ['80小时发条盒', '计时精度'],
                'parts' => ['柱轮', '垂直离合器', '多发条盒']
            ],
            ['brand' => 'TAG', 'code' => 'Heuer 01', 'commonName' => 'Heuer 01 模块化计时', 'family' => '01', 'jewels' => 39, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -6, 'rateMax' => 8, 'beatErr' => 0.5, 'pr' => 50, 'labor' => 6.5, 'wr' => '10 ATM',
                'desc' => '模块化计时机芯，ETA7750进化，镂空设计',
                'steps' => ['模块化组装检查', '镂空夹板清洁', '计时测试'],
                'faults' => ['模块化连接', '镂空结构强度'],
                'parts' => ['镂空夹板', '计时锤']
            ],
            ['brand' => 'TAG', 'code' => 'CAL.5', 'commonName' => 'Cal.5 自动三针', 'family' => '5', 'jewels' => 26, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -6, 'rateMax' => 8, 'beatErr' => 0.5, 'pr' => 38, 'labor' => 4.0, 'wr' => '10 ATM',
                'desc' => 'SW200精改版，竞潜/卡莱拉入门款',
                'steps' => ['SW200精改调校', 'COSC标准测试'],
                'faults' => ['自动上链效率', '精度'],
                'parts' => ['精调摆轮', '自动轮组']
            ],
            // ===== Longines 浪琴 =====
            ['brand' => 'Longines', 'code' => 'L888.2', 'commonName' => 'L888.2 自动', 'family' => 'L888', 'jewels' => 21, 'freq' => 25200, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -6, 'rateMax' => 8, 'beatErr' => 0.5, 'pr' => 64, 'labor' => 4.0, 'wr' => '5 ATM',
                'desc' => 'ETA2892-A2改，64小时动力，名匠/康卡斯主力',
                'steps' => ['64小时动力测试', '25200摆频调校', '浪琴标准'],
                'faults' => ['降摆频提高动力', '精度调校'],
                'parts' => ['新发条盒', '摆轮组件']
            ],
            ['brand' => 'Longines', 'code' => 'L619.2', 'commonName' => 'L619.2 自动', 'family' => 'L619', 'jewels' => 21, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -6, 'rateMax' => 8, 'beatErr' => 0.5, 'pr' => 42, 'labor' => 3.8, 'wr' => '5 ATM',
                'desc' => 'ETA2892-A2老款，名匠系列经典',
                'steps' => ['ETA2892标准保养', '28800摆频调校'],
                'faults' => ['自动陀轴承磨损', '上链齿轮'],
                'parts' => ['自动陀轴承', '主发条']
            ],
            ['brand' => 'Longines', 'code' => 'L688.2', 'commonName' => 'L688.2 自动计时', 'family' => 'L688', 'jewels' => 27, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -8, 'rateMax' => 10, 'beatErr' => 0.6, 'pr' => 54, 'labor' => 5.5, 'wr' => '5 ATM',
                'desc' => 'ETA7750改，导柱轮结构，浪琴导柱轮计时',
                'steps' => ['导柱轮转换保养', '计时功能测试'],
                'faults' => ['导柱轮磨损', '7750经典问题'],
                'parts' => ['导柱轮', '凸轮改导柱轮套件']
            ],
            // ===== Tudor 帝舵 =====
            ['brand' => 'Tudor', 'code' => 'MT5602', 'commonName' => 'MT5602 自产自动', 'family' => 'MT56', 'jewels' => 26, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 70, 'labor' => 6.0, 'wr' => '20 ATM',
                'desc' => '帝舵首款自产机芯，70小时动力，硅游丝，COSC认证',
                'steps' => ['COSC认证调校', '硅游丝检查', '70H动力测试'],
                'faults' => ['硅游丝安装', '自动上链机构'],
                'parts' => ['硅游丝', '双发条盒', '大钢轮']
            ],
            ['brand' => 'Tudor', 'code' => 'MT5612', 'commonName' => 'MT5612 自产自动日历', 'family' => 'MT56', 'jewels' => 26, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 70, 'labor' => 6.0, 'wr' => '20 ATM',
                'desc' => 'MT5602加日历，黑盾/蓝盾/碧湾58主力',
                'steps' => ['日历机构检查', 'COSC认证', '70H动力'],
                'faults' => ['日历跳历', '硅游丝'],
                'parts' => ['日历轮', '硅游丝']
            ],
            ['brand' => 'Tudor', 'code' => 'MT5813', 'commonName' => 'MT5813 自产计时', 'family' => 'MT58', 'jewels' => 34, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.25, 'pr' => 70, 'labor' => 8.0, 'wr' => '20 ATM',
                'desc' => '帝舵自产计时，B01合作基础，70小时动力，导柱轮',
                'steps' => ['导柱轮测试', '垂直离合调校', 'COSC认证'],
                'faults' => ['导柱轮', '垂直离合器'],
                'parts' => ['导柱轮', '垂直离合器']
            ],
            // ===== Panerai 沛纳海 =====
            ['brand' => 'Panerai', 'code' => 'P.3000', 'commonName' => 'P.3000 手卷', 'family' => 'P.3000', 'jewels' => 21, 'freq' => 21600, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -5, 'rateMax' => 5, 'beatErr' => 0.6, 'pr' => 72, 'labor' => 5.0, 'wr' => '10 ATM',
                'desc' => '沛纳海自产手卷机芯，72小时动力，Luminor Due使用',
                'steps' => ['手卷机构检查', '72H动力测试', '大尺寸平衡'],
                'faults' => ['大尺寸机芯平衡', '双发条盒同步'],
                'parts' => ['双发条盒', '大摆轮']
            ],
            ['brand' => 'Panerai', 'code' => 'P.4000', 'commonName' => 'P.4000 自动微型摆陀', 'family' => 'P.4000', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.4, 'pr' => 72, 'labor' => 6.5, 'wr' => '10 ATM',
                'desc' => '沛纳海自动，偏心微型摆陀，72小时动力',
                'steps' => ['微型摆陀检查', '偏心上链效率测试', '72H动力'],
                'faults' => ['微型摆陀轴承', '偏心上链效率'],
                'parts' => ['微型摆陀', '双发条盒']
            ],
            ['brand' => 'Panerai', 'code' => 'OP XI', 'commonName' => 'OP XI 自动', 'family' => 'OP', 'jewels' => 21, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -6, 'rateMax' => 8, 'beatErr' => 0.5, 'pr' => 56, 'labor' => 4.0, 'wr' => '10 ATM',
                'desc' => 'ETA7750改单历，Luminor经典入门款',
                'steps' => ['ETA基础保养', '计时模块移除后调校'],
                'faults' => ['7750改单历结构', '自动上链'],
                'parts' => ['主发条', '自动轮组']
            ],
            // ===== Zenith 真力时 =====
            ['brand' => 'Zenith', 'code' => 'El Primero 36000', 'commonName' => 'El Primero 36000 高频计时', 'family' => 'El Primero', 'jewels' => 31, 'freq' => 36000, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.2, 'pr' => 50, 'labor' => 8.0, 'wr' => '5 ATM',
                'desc' => '传奇高频计时机芯，36000摆频，1/10秒计时',
                'steps' => ['高频摆轮调校', '36000振动测试', '导柱轮检查'],
                'faults' => ['高频磨损加剧', '润滑油要求高', '摆轮游丝'],
                'parts' => ['高频摆轮', '导柱轮', '特殊润滑油']
            ],
            ['brand' => 'Zenith', 'code' => 'El Primero 3600', 'commonName' => 'El Primero 3600 新一代', 'family' => 'El Primero 3600', 'jewels' => 31, 'freq' => 36000, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -1, 'rateMax' => 1, 'beatErr' => 0.15, 'pr' => 60, 'labor' => 9.0, 'wr' => '5 ATM',
                'desc' => '新一代高频，60小时动力，1/100秒计时，50年质保',
                'steps' => ['1/100秒计时测试', '60H动力', '50年质保标准调校'],
                'faults' => ['1/100秒机构复杂', '碳复合材料零件'],
                'parts' => ['碳摆轮', '硅擒纵', '多发条盒']
            ],
            ['brand' => 'Zenith', 'code' => '670', 'commonName' => 'Cal.670 自动', 'family' => '670', 'jewels' => 26, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -5, 'rateMax' => 5, 'beatErr' => 0.4, 'pr' => 50, 'labor' => 4.5, 'wr' => '5 ATM',
                'desc' => '真力时自动基础机芯，Elite系列',
                'steps' => ['Elite标准调校', '50H动力测试'],
                'faults' => ['自动上链效率', '薄型机芯'],
                'parts' => ['自动轮组', '发条盒']
            ],
            // ===== Hamilton 汉米尔顿 =====
            ['brand' => 'Hamilton', 'code' => 'H-10', 'commonName' => 'H-10 自动', 'family' => 'H-10', 'jewels' => 25, 'freq' => 21600, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -10, 'rateMax' => 15, 'beatErr' => 0.7, 'pr' => 80, 'labor' => 3.0, 'wr' => '5 ATM',
                'desc' => 'ETA2824改，80小时动力，卡其野战/海军蛙人',
                'steps' => ['80H动力测试', '21600摆频调校'],
                'faults' => ['降摆频提动力', '精度一般'],
                'parts' => ['80小时发条盒', '摆轮组件']
            ],
            ['brand' => 'Hamilton', 'code' => 'H-21', 'commonName' => 'H-21 自动计时', 'family' => 'H-21', 'jewels' => 27, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -8, 'rateMax' => 10, 'beatErr' => 0.6, 'pr' => 60, 'labor' => 5.0, 'wr' => '10 ATM',
                'desc' => 'ETA7750改，60小时动力，卡其航空计时',
                'steps' => ['60H动力测试', '凸轮系统检查'],
                'faults' => ['凸轮磨损', '7750经典问题'],
                'parts' => ['发条盒', '凸轮组件']
            ],
            ['brand' => 'Hamilton', 'code' => 'H-31', 'commonName' => 'H-31 自动计时', 'family' => 'H-31', 'jewels' => 27, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -8, 'rateMax' => 10, 'beatErr' => 0.6, 'pr' => 60, 'labor' => 5.0, 'wr' => '10 ATM',
                'desc' => 'ETA7753改，60小时动力，导航表风格',
                'steps' => ['60H动力测试', '双历快拨检查'],
                'faults' => ['凸轮磨损', '双历机构'],
                'parts' => ['发条盒', '凸轮', '日历轮']
            ],
            // ===== Tissot 天梭 =====
            ['brand' => 'Tissot', 'code' => 'Powermatic 80', 'commonName' => 'Powermatic 80 自动', 'family' => 'PM80', 'jewels' => 23, 'freq' => 21600, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -10, 'rateMax' => 15, 'beatErr' => 0.7, 'pr' => 80, 'labor' => 2.8, 'wr' => '5 ATM',
                'desc' => 'ETA2824改，80小时动力，天梭主力机芯，性价比高',
                'steps' => ['80H动力测试', '21600摆频调校'],
                'faults' => ['降摆频提高动力', '精度偏一般', '塑料擒纵轮'],
                'parts' => ['80小时发条盒', '摆轮组件']
            ],
            ['brand' => 'Tissot', 'code' => 'C01.211', 'commonName' => 'C01.211 自动计时', 'family' => 'C01', 'jewels' => 15, 'freq' => 21600, 'ampMin' => 240, 'ampMax' => 290, 'rateMin' => -12, 'rateMax' => 18, 'beatErr' => 0.8, 'pr' => 45, 'labor' => 4.0, 'wr' => '10 ATM',
                'desc' => '天梭入门自动计时，Lemania 5100基础，成本控制',
                'steps' => ['低成本计时机芯保养', '21600摆频调校'],
                'faults' => ['宝石数少只有15钻', '精度较低', '塑料零件'],
                'parts' => ['主发条', '凸轮组件']
            ],
            // ===== Mido 美度 =====
            ['brand' => 'Mido', 'code' => 'Caliber 80', 'commonName' => 'Caliber 80 自动', 'family' => 'C80', 'jewels' => 25, 'freq' => 21600, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -10, 'rateMax' => 15, 'beatErr' => 0.7, 'pr' => 80, 'labor' => 3.0, 'wr' => '5 ATM',
                'desc' => 'ETA2824改，80小时动力，硅游丝可选，贝伦赛丽/指挥官',
                'steps' => ['80H动力测试', '可选硅游丝检查'],
                'faults' => ['降摆频', '塑料擒纵轮'],
                'parts' => ['80小时发条盒', '可选硅游丝']
            ],
            ['brand' => 'Mido', 'code' => 'Caliber 60', 'commonName' => 'Caliber 60 自动计时', 'family' => 'C60', 'jewels' => 27, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -8, 'rateMax' => 10, 'beatErr' => 0.6, 'pr' => 60, 'labor' => 5.0, 'wr' => '10 ATM',
                'desc' => 'ETA7753改，60小时动力，完美星期日历+计时',
                'steps' => ['60H动力测试', '双历+计时调校'],
                'faults' => ['经典7753问题', '凸轮磨损'],
                'parts' => ['发条盒', '凸轮组件']
            ],
            // ===== Swiss ETA 更多款 =====
            ['brand' => 'ETA', 'code' => '2834-2', 'commonName' => 'ETA 2834-2 自动双历', 'family' => '28xx', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 310, 'rateMin' => -12, 'rateMax' => 12, 'beatErr' => 0.6, 'pr' => 40, 'labor' => 4.0, 'wr' => '5 ATM',
                'desc' => 'ETA2824加星期+日历，天梭/美度入门款',
                'steps' => ['双历调校', '自动上链测试'],
                'faults' => ['历机构磨损', '跳历不准'],
                'parts' => ['星期轮', '日历轮']
            ],
            ['brand' => 'ETA', 'code' => '955.112', 'commonName' => 'ETA 955.112 石英', 'type' => 'quartz', 'family' => '955', 'jewels' => 7, 'freq' => 32768, 'ampMin' => 0, 'ampMax' => 0, 'rateMin' => -0.5, 'rateMax' => 0.5, 'beatErr' => 0.0, 'pr' => 0, 'labor' => 1.0, 'wr' => '3 ATM',
                'desc' => '经典瑞士石英机芯，7钻，年差±15秒',
                'steps' => ['电池更换', '线圈测试', '电路检查'],
                'faults' => ['电池耗尽', '线圈氧化', '步进马达'],
                'parts' => ['364电池', '线圈', 'IC']
            ],
            ['brand' => 'ETA', 'code' => '955.412', 'commonName' => 'ETA 955.412 石英大日历', 'type' => 'quartz', 'family' => '955', 'jewels' => 7, 'freq' => 32768, 'ampMin' => 0, 'ampMax' => 0, 'rateMin' => -0.5, 'rateMax' => 0.5, 'beatErr' => 0.0, 'pr' => 0, 'labor' => 1.2, 'wr' => '3 ATM',
                'desc' => '石英机芯加大日历视窗，天梭/美度石英款',
                'steps' => ['电池更换', '大日历轮检查'],
                'faults' => ['电池', '大日历轮'],
                'parts' => ['364电池', '大日历轮']
            ],
            ['brand' => 'Ronda', 'code' => '715', 'commonName' => 'Ronda 715 石英', 'type' => 'quartz', 'family' => '700', 'jewels' => 3, 'freq' => 32768, 'ampMin' => 0, 'ampMax' => 0, 'rateMin' => -0.5, 'rateMax' => 0.5, 'beatErr' => 0.0, 'pr' => 0, 'labor' => 0.8, 'wr' => '5 ATM',
                'desc' => '朗达三针石英，3钻，入门瑞士石英标准',
                'steps' => ['电池更换', '防水圈检查'],
                'faults' => ['电池漏液', '马达线圈'],
                'parts' => ['371电池', '线圈']
            ],
            ['brand' => 'Ronda', 'code' => '5040.D', 'commonName' => 'Ronda 5040.D 石英计时', 'type' => 'quartz', 'family' => '5000', 'jewels' => 6, 'freq' => 32768, 'ampMin' => 0, 'ampMax' => 0, 'rateMin' => -0.5, 'rateMax' => 0.5, 'beatErr' => 0.0, 'pr' => 0, 'labor' => 1.5, 'wr' => '10 ATM',
                'desc' => '朗达石英计时，1/10秒，大数字视窗，运动款常用',
                'steps' => ['电池更换', '计时测试', '马达检查'],
                'faults' => ['多马达驱动复杂', '耗电快'],
                'parts' => ['395电池', '步进马达', 'IC']
            ],
            // ===== Citizen 西铁城机芯 =====
            ['brand' => 'Citizen', 'code' => 'Miyota 9039', 'commonName' => 'Miyota 9039 自动超薄', 'family' => '90xx', 'jewels' => 24, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 310, 'rateMin' => -10, 'rateMax' => 30, 'beatErr' => 0.6, 'pr' => 42, 'labor' => 3.5, 'wr' => '5 ATM',
                'desc' => '9015小改版，超薄3.9mm，大量品牌使用',
                'steps' => ['超薄装配', '3.9mm厚度控制'],
                'faults' => ['超薄零件脆弱', '自动陀异响'],
                'parts' => ['超薄发条盒', '微型自动轮']
            ],
            ['brand' => 'Citizen', 'code' => '0100', 'commonName' => 'Cal.0100 光动能年差', 'type' => 'quartz', 'family' => '0100', 'jewels' => 3, 'freq' => 8388608, 'ampMin' => 0, 'ampMax' => 0, 'rateMin' => -0.05, 'rateMax' => 0.05, 'beatErr' => 0.0, 'pr' => 0, 'labor' => 5.0, 'wr' => '5 ATM',
                'desc' => '西铁城年差±1秒机芯，8.3MHz高频晶体，光动力',
                'steps' => ['光动力电池检查', '8MHz晶体测试', '年差精度验证'],
                'faults' => ['高频晶体老化', '光充电电池寿命', '±1秒极限精度'],
                'parts' => ['8MHz晶振', '光充电电池', 'IC模块']
            ],
            ['brand' => 'Citizen', 'code' => 'Eco-Drive J800', 'commonName' => 'Eco-Drive J800 光动能', 'type' => 'quartz', 'family' => 'J800', 'jewels' => 3, 'freq' => 32768, 'ampMin' => 0, 'ampMax' => 0, 'rateMin' => -0.5, 'rateMax' => 0.5, 'beatErr' => 0.0, 'pr' => 0, 'labor' => 1.5, 'wr' => '10 ATM',
                'desc' => '西铁城光动能基础机芯，充满电可走6个月',
                'steps' => ['光电池测试', '充电电路检查', '电池更换'],
                'faults' => ['充电电池老化', '太阳能面板', '电路故障'],
                'parts' => ['光充电电池', '太阳能面板', '线圈']
            ],
            // ===== Seagull 海鸥机芯 =====
            ['brand' => 'SeaGull', 'code' => 'ST2130', 'commonName' => 'ST2130 自动', 'family' => 'ST21', 'jewels' => 26, 'freq' => 28800, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -12, 'rateMax' => 18, 'beatErr' => 0.8, 'pr' => 42, 'labor' => 2.5, 'wr' => '5 ATM',
                'desc' => 'ETA2824-2仿品，海鸥最经典自动机芯，国产表大量使用',
                'steps' => ['ST2130标准保养', '摆轮平衡调校'],
                'faults' => ['仿2824精度不稳定', '自动上链效率', '零件一致性'],
                'parts' => ['主发条', '自动轮', 'Incabloc避震簧']
            ],
            ['brand' => 'SeaGull', 'code' => 'ST2500', 'commonName' => 'ST2500 自动双历', 'family' => 'ST25', 'jewels' => 34, 'freq' => 21600, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -15, 'rateMax' => 25, 'beatErr' => 0.9, 'pr' => 45, 'labor' => 3.0, 'wr' => '5 ATM',
                'desc' => 'ETA2836仿品，加飞返/能量显示等复杂模块',
                'steps' => ['双历调校', '飞返模块检查'],
                'faults' => ['复杂模块可靠性', '精度偏低'],
                'parts' => ['日历轮', '飞返锤']
            ],
            ['brand' => 'SeaGull', 'code' => 'ST3600', 'commonName' => 'ST3600 手卷', 'family' => 'ST36', 'jewels' => 17, 'freq' => 21600, 'ampMin' => 250, 'ampMax' => 300, 'rateMin' => -12, 'rateMax' => 15, 'beatErr' => 0.9, 'pr' => 42, 'labor' => 2.0, 'wr' => '3 ATM',
                'desc' => 'Unitas 6497仿品，大尺寸手卷，沛纳海风格',
                'steps' => ['大摆轮平衡', '鹅颈微调调校'],
                'faults' => ['21600摆频精度', '鹅颈微调'],
                'parts' => ['大摆轮', '鹅颈微调', '游丝']
            ],
            ['brand' => 'SeaGull', 'code' => 'ST1902', 'commonName' => 'ST1902 手卷计时', 'family' => 'ST19', 'jewels' => 19, 'freq' => 21600, 'ampMin' => 240, 'ampMax' => 290, 'rateMin' => -12, 'rateMax' => 18, 'beatErr' => 0.8, 'pr' => 42, 'labor' => 4.5, 'wr' => '3 ATM',
                'desc' => 'Venus 175仿品，导柱轮手卷计时，国产唯一柱轮计时',
                'steps' => ['导柱轮检查', '凸轮水平离合调校', '计时测试'],
                'faults' => ['Venus老设计', '计时精度', '零件精度'],
                'parts' => ['导柱轮', '凸轮', '计时锤']
            ],
            // ===== Beijing 北京手表厂 =====
            ['brand' => 'Beijing', 'code' => 'B16', 'commonName' => 'B16 自动', 'family' => 'B16', 'jewels' => 25, 'freq' => 28800, 'ampMin' => 240, 'ampMax' => 290, 'rateMin' => -12, 'rateMax' => 18, 'beatErr' => 0.8, 'pr' => 40, 'labor' => 2.5, 'wr' => '5 ATM',
                'desc' => '北表自产自动基础机芯，中华陀飞轮同厂基础',
                'steps' => ['北表标准调校', '自动上链测试'],
                'faults' => ['精度一致性', '自动上链效率'],
                'parts' => ['主发条', '自动轮组']
            ],
            ['brand' => 'Beijing', 'code' => 'SB18', 'commonName' => 'SB18 超薄自动', 'family' => 'SB18', 'jewels' => 24, 'freq' => 28800, 'ampMin' => 240, 'ampMax' => 290, 'rateMin' => -10, 'rateMax' => 15, 'beatErr' => 0.7, 'pr' => 42, 'labor' => 3.0, 'wr' => '3 ATM',
                'desc' => '北表超薄自动机芯，3.9mm，名筑系列',
                'steps' => ['超薄装配', '厚度控制'],
                'faults' => ['超薄零件脆弱', '齿轮咬合精度'],
                'parts' => ['超薄发条盒', '微型齿轮']
            ],
            // ===== Fiyta 飞亚达 =====
            ['brand' => 'Fiyta', 'code' => 'Cal.80', 'commonName' => '飞亚达Cal.80 自动', 'family' => '80', 'jewels' => 25, 'freq' => 21600, 'ampMin' => 240, 'ampMax' => 290, 'rateMin' => -12, 'rateMax' => 18, 'beatErr' => 0.8, 'pr' => 80, 'labor' => 2.8, 'wr' => '5 ATM',
                'desc' => '飞亚达与SW合作研发，80小时动力，神舟航天表使用',
                'steps' => ['80H动力测试', '航天级振动测试'],
                'faults' => ['21600摆频精度', '特殊环境适应性'],
                'parts' => ['80H发条盒', '航天级润滑油']
            ],
            // ===== Rolex 更多女款 =====
            ['brand' => 'Rolex', 'code' => '2236', 'commonName' => 'Cal.2236 女款恒动', 'family' => '22xx', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 300, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.25, 'pr' => 55, 'labor' => 5.0, 'wr' => '10 ATM',
                'desc' => '女款机芯，SYNCHRONY硅游丝，55小时动力，COSC认证',
                'steps' => ['SYNCHRONY硅游丝检查', '55H动力测试', 'COSC认证'],
                'faults' => ['女款精密零件', '硅游丝安装'],
                'parts' => ['SYNCHRONY硅游丝', '双发条盒']
            ],
            // ===== Cartier 卡地亚更多款 =====
            ['brand' => 'Cartier', 'code' => '1904-PS MC', 'commonName' => '1904-PS MC 自动', 'family' => '1904', 'jewels' => 27, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -5, 'rateMax' => 5, 'beatErr' => 0.4, 'pr' => 48, 'labor' => 5.5, 'wr' => '5 ATM',
                'desc' => '卡地亚首款自产自动机芯，CALIBRE DE CARTIER系列',
                'steps' => ['双向自动上链测试', '48H动力测试', '卡地亚认证'],
                'faults' => ['自动陀轴承', '上链效率'],
                'parts' => ['双向上链组件', '双发条盒']
            ],
            ['brand' => 'Cartier', 'code' => '9603 MC', 'commonName' => '9603 MC 超薄手卷', 'family' => '9600', 'jewels' => 23, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -4, 'rateMax' => 4, 'beatErr' => 0.4, 'pr' => 42, 'labor' => 6.0, 'wr' => '3 ATM',
                'desc' => '超薄手卷机芯，4.3mm，Drive de Cartier',
                'steps' => ['超薄装配', '齿轮间隙精密检查'],
                'faults' => ['超薄零件', '精密调校'],
                'parts' => ['超薄发条盒', '微型齿轮']
            ],
            // ===== IWC 万国更多款 =====
            ['brand' => 'IWC', 'code' => '80111', 'commonName' => '80111 啄木鸟自动', 'family' => '8011', 'jewels' => 28, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -5, 'rateMax' => 5, 'beatErr' => 0.5, 'pr' => 44, 'labor' => 5.0, 'wr' => '10 ATM',
                'desc' => 'IWC比勒顿啄木鸟上链，马克系列经典，ETA7750基础改',
                'steps' => ['啄木鸟上链机构检查', '44H动力测试'],
                'faults' => ['啄木鸟棘爪磨损', '经典7750问题'],
                'parts' => ['啄木鸟棘爪', '发条盒']
            ],
            ['brand' => 'IWC', 'code' => '89361', 'commonName' => '89361 飞返计时', 'family' => '8936', 'jewels' => 38, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -4, 'rateMax' => 6, 'beatErr' => 0.4, 'pr' => 68, 'labor' => 8.0, 'wr' => '6 ATM',
                'desc' => 'IWC自产飞返计时机芯，导柱轮+68小时动力',
                'steps' => ['飞返机构测试', '导柱轮检查', '68H动力'],
                'faults' => ['飞返锤磨损', '导柱轮'],
                'parts' => ['飞返锤', '导柱轮', '双发条盒']
            ],
            ['brand' => 'IWC', 'code' => '52010', 'commonName' => '52010 八日链自动', 'family' => '5200', 'jewels' => 24, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.3, 'pr' => 168, 'labor' => 7.5, 'wr' => '6 ATM',
                'desc' => 'IWC八日链机芯，双发条盒，168小时动力，葡萄牙系列',
                'steps' => ['八日动力测试', '双发条盒同步检查', '七天储能'],
                'faults' => ['长动力发条盒', '力矩输出稳定'],
                'parts' => ['双发条盒', '长动力发条', '比勒顿啄木鸟']
            ],
            // ===== Patek Philippe 百达翡丽更多 =====
            ['brand' => 'Patek Philippe', 'code' => '26-330 S C', 'commonName' => 'Cal.26-330 SC 自动', 'family' => '26-330', 'jewels' => 27, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 48, 'labor' => 8.0, 'wr' => '5 ATM',
                'desc' => '百达翡丽自动基础机芯，28-520升级款',
                'steps' => ['PP认证调校', 'Gyromax摆轮调校', '六方位测试'],
                'faults' => ['PP高精度要求', '手工调校'],
                'parts' => ['Gyromax摆轮', 'Spiromax硅游丝']
            ],
            ['brand' => 'Patek Philippe', 'code' => 'CH 28-520 IRM QA', 'commonName' => 'Cal.CH 28-520 追针计时', 'family' => 'CH 28', 'jewels' => 45, 'freq' => 28800, 'ampMin' => 260, 'ampMax' => 300, 'rateMin' => -3, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 55, 'labor' => 12.0, 'wr' => '3 ATM',
                'desc' => '百达翡丽追针计时机芯，双导柱轮+三问报时+万年历',
                'steps' => ['追针测试', '三问报时检测', '万年历调校'],
                'faults' => ['超级复杂功能', '追针轮系', '三问音锤'],
                'parts' => ['追针轮', '三问音锤', '导柱轮x2']
            ],
            // ===== Audemars Piguet 爱彼更多 =====
            ['brand' => 'AP', 'code' => '3126/3840', 'commonName' => 'Cal.3126 自动计时', 'family' => '31xx', 'jewels' => 59, 'freq' => 21600, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.3, 'pr' => 65, 'labor' => 10.0, 'wr' => '5 ATM',
                'desc' => '3120加计时模块，皇家橡树离岸计时款',
                'steps' => ['计时模块调校', '65H动力测试', '导柱轮检查'],
                'faults' => ['模块连接', '导柱轮'],
                'parts' => ['导柱轮', '计时模块']
            ],
            ['brand' => 'AP', 'code' => '4302', 'commonName' => 'Cal.4302 超薄自动', 'family' => '4302', 'jewels' => 38, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.25, 'pr' => 70, 'labor' => 9.5, 'wr' => '5 ATM',
                'desc' => '新一代皇家橡树15500机芯，70小时动力，3.45mm超薄',
                'steps' => ['超薄装配', '70H动力测试', 'AP顶级调校'],
                'faults' => ['超薄零件精密', '双发条盒同步'],
                'parts' => ['双发条盒', '超薄摆轮', '硅游丝']
            ],
            // ===== Blancpain 宝珀 =====
            ['brand' => 'Blancpain', 'code' => '1151', 'commonName' => 'Cal.1151 长动力自动', 'family' => '1150', 'jewels' => 31, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.3, 'pr' => 100, 'labor' => 8.5, 'wr' => '5 ATM',
                'desc' => '宝珀长动力自动机芯，100小时动力，双发条盒',
                'steps' => ['100H动力测试', '硅游丝检查', '宝珀标准'],
                'faults' => ['长动力发条盒', '力矩输出'],
                'parts' => ['双发条盒', '硅游丝']
            ],
            ['brand' => 'Blancpain', 'code' => '1315', 'commonName' => 'Cal.1315 五十噚机芯', 'family' => '1315', 'jewels' => 35, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.3, 'pr' => 120, 'labor' => 9.0, 'wr' => '30 ATM',
                'desc' => '五十噚深潜器专属，120小时动力，三发条盒',
                'steps' => ['120H动力测试', '三发条盒同步', '30ATM防水测试'],
                'faults' => ['三发条盒力矩', '深潜防水'],
                'parts' => ['三发条盒', '硅游丝', '防磁组件']
            ],
            // ===== Breguet 宝玑 =====
            ['brand' => 'Breguet', 'code' => '587/1', 'commonName' => 'Cal.587/1 超薄自动', 'family' => '500', 'jewels' => 24, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.3, 'pr' => 55, 'labor' => 8.5, 'wr' => '3 ATM',
                'desc' => '宝玑超薄自动机芯，3mm厚度，Classique系列',
                'steps' => ['超薄装配', '宝玑传统调校', '手工雕花检查'],
                'faults' => ['超薄零件', '手工雕花夹板'],
                'parts' => ['超薄发条盒', '手工雕花夹板']
            ],
            // ===== Girard-Perregaux 芝柏 =====
            ['brand' => 'GP', 'code' => 'Cal.3300', 'commonName' => 'Cal.3300 自动', 'family' => '3300', 'jewels' => 27, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.25, 'pr' => 46, 'labor' => 7.5, 'wr' => '5 ATM',
                'desc' => '芝柏新一代自动基础机芯，46小时动力，金桥风格',
                'steps' => ['GP标准调校', '46H动力测试'],
                'faults' => ['高精度要求', '零件装饰打磨'],
                'parts' => ['双发条盒', '硅擒纵叉']
            ],
            // ===== Chopard 萧邦 =====
            ['brand' => 'Chopard', 'code' => 'L.U.C 1.96', 'commonName' => 'L.U.C 1.96 超薄自动', 'family' => 'L.U.C', 'jewels' => 33, 'freq' => 28800, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -3, 'rateMax' => 3, 'beatErr' => 0.25, 'pr' => 65, 'labor' => 9.0, 'wr' => '3 ATM',
                'desc' => '萧邦L.U.C顶级机芯，3.3mm超薄，双发条盒，日内瓦印记',
                'steps' => ['日内瓦印记认证', '65H动力测试', '超薄装配'],
                'faults' => ['日内瓦印记要求', '微型摆陀'],
                'parts' => ['微型摆陀', '双发条盒', '日内瓦纹夹板']
            ],
            // ===== Girard-Perregaux 更多 =====
            ['brand' => 'GP', 'code' => 'Cal.9010', 'commonName' => 'Cal.9010 高频自动', 'family' => '9000', 'jewels' => 39, 'freq' => 36000, 'ampMin' => 270, 'ampMax' => 310, 'rateMin' => -2, 'rateMax' => 2, 'beatErr' => 0.2, 'pr' => 60, 'labor' => 8.5, 'wr' => '5 ATM',
                'desc' => '芝柏高频自动，36000摆频，60小时动力，硅擒纵',
                'steps' => ['36000高频测试', '60H动力', '硅擒纵检查'],
                'faults' => ['高频磨损', '特殊润滑油'],
                'parts' => ['硅游丝', '硅擒纵叉', '高频摆轮']
            ],
        ];
    }
}
