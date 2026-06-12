<?php

namespace App\Service;

use App\Entity\WorkOrder;
use App\Repository\WorkOrderRepository;
use App\Repository\PartsRepository;
use App\Repository\WarrantyRepository;
use App\Repository\CustomerRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Cache\CacheItemPoolInterface;

class DashboardStatsService
{
    private const CACHE_TTL = 60;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly WorkOrderRepository $orderRepo,
        private readonly PartsRepository $partsRepo,
        private readonly WarrantyRepository $warrantyRepo,
        private readonly CustomerRepository $customerRepo,
        private readonly CacheItemPoolInterface $cache,
        private readonly WarrantyNotificationService $warrantyService,
    ) {}

    public function overview(): array
    {
        $cacheKey = 'dashboard_overview_' . date('Y-m-d-H');
        $cacheItem = $this->cache->getItem($cacheKey);
        if ($cacheItem->isHit()) {
            return $cacheItem->get();
        }

        $today = new \DateTimeImmutable();
        $weekStart = $today->modify('-7 days');
        $monthStart = $today->modify('first day of this month 00:00:00');

        $result = [
            'summary' => $this->buildSummary($today, $weekStart),
            'byStatus' => $this->countByStatus(),
            'byType' => $this->revenueByType($weekStart, $today),
            'trend' => $this->weeklyTrend(),
            'recent' => $this->recentOrders(10),
            'lowStock' => $this->lowStockSummary(),
            'warrantyAlerts' => $this->warrantyService->listExpiring(60),
            'topTechnicians' => $this->topTechnicians($monthStart, $today),
            'customerGrowth' => $this->customerGrowth(),
            'generatedAt' => $today->format('Y-m-d H:i:s'),
            'cacheKey' => $cacheKey,
        ];

        $cacheItem->set($result);
        $cacheItem->expiresAfter(self::CACHE_TTL);
        $this->cache->save($cacheItem);

        return $result;
    }

    private function buildSummary(\DateTimeImmutable $today, \DateTimeImmutable $weekStart): array
    {
        $weekOrders = (int)$this->orderRepo->createQueryBuilder('wo')
            ->select('COUNT(wo.id)')
            ->where('wo.intakeDate >= :ws')
            ->setParameter('ws', $weekStart)
            ->getQuery()
            ->getSingleScalarResult();

        $pendingPickup = (int)$this->orderRepo->createQueryBuilder('wo')
            ->select('COUNT(wo.id)')
            ->where('wo.status = :s')
            ->setParameter('s', WorkOrder::STATUS_READY_FOR_PICKUP)
            ->getQuery()
            ->getSingleScalarResult();

        $inRepair = (int)$this->orderRepo->createQueryBuilder('wo')
            ->select('COUNT(wo.id)')
            ->where('wo.status = :s')
            ->setParameter('s', WorkOrder::STATUS_IN_REPAIR)
            ->getQuery()
            ->getSingleScalarResult();

        $avgCycleDays = $this->calculateAvgCycle($weekStart, $today);

        $revenue = (float)$this->orderRepo->createQueryBuilder('wo')
            ->select('COALESCE(SUM(CAST(wo.totalPrice AS DECIMAL(10,2))), 0)')
            ->where('wo.status IN (:delivered)')
            ->andWhere('wo.actualDeliveryDate >= :ws')
            ->setParameter('delivered', [WorkOrder::STATUS_DELIVERED, WorkOrder::STATUS_WARRANTY, WorkOrder::STATUS_ARCHIVED])
            ->setParameter('ws', $weekStart)
            ->getQuery()
            ->getSingleScalarResult();

        $pendingQuote = (int)$this->orderRepo->createQueryBuilder('wo')
            ->select('COUNT(wo.id)')
            ->where('wo.status = :s')
            ->setParameter('s', WorkOrder::STATUS_PENDING_QUOTE)
            ->getQuery()
            ->getSingleScalarResult();

        $totalCustomers = (int)$this->customerRepo->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->getQuery()
            ->getSingleScalarResult();

        return [
            'weekOrders' => $weekOrders,
            'pendingPickup' => $pendingPickup,
            'pendingQuote' => $pendingQuote,
            'inRepair' => $inRepair,
            'avgCycleDays' => $avgCycleDays,
            'weekRevenue' => round($revenue, 2),
            'totalCustomers' => $totalCustomers,
        ];
    }

    private function countByStatus(): array
    {
        $rows = $this->orderRepo->createQueryBuilder('wo')
            ->select('wo.status, COUNT(wo.id) AS cnt')
            ->groupBy('wo.status')
            ->getQuery()
            ->getResult();

        $statusMap = [];
        $all = [
            WorkOrder::STATUS_DRAFT, WorkOrder::STATUS_PENDING_QUOTE,
            WorkOrder::STATUS_QUOTED, WorkOrder::STATUS_IN_REPAIR,
            WorkOrder::STATUS_PENDING_QA, WorkOrder::STATUS_READY_FOR_PICKUP,
            WorkOrder::STATUS_DELIVERED, WorkOrder::STATUS_WARRANTY,
            WorkOrder::STATUS_ARCHIVED,
        ];
        foreach ($all as $s) {
            $statusMap[$s] = 0;
        }
        foreach ($rows as $r) {
            $statusMap[$r['status']] = (int)$r['cnt'];
        }

        $labelMap = [
            WorkOrder::STATUS_DRAFT => '草稿',
            WorkOrder::STATUS_PENDING_QUOTE => '待报价',
            WorkOrder::STATUS_QUOTED => '已报价',
            WorkOrder::STATUS_IN_REPAIR => '维修中',
            WorkOrder::STATUS_PENDING_QA => '待质检',
            WorkOrder::STATUS_READY_FOR_PICKUP => '待取件',
            WorkOrder::STATUS_DELIVERED => '已交付',
            WorkOrder::STATUS_WARRANTY => '质保中',
            WorkOrder::STATUS_ARCHIVED => '已归档',
        ];

        $colorMap = [
            WorkOrder::STATUS_DRAFT => '#9ca3af',
            WorkOrder::STATUS_PENDING_QUOTE => '#f59e0b',
            WorkOrder::STATUS_QUOTED => '#8b5cf6',
            WorkOrder::STATUS_IN_REPAIR => '#3b82f6',
            WorkOrder::STATUS_PENDING_QA => '#ec4899',
            WorkOrder::STATUS_READY_FOR_PICKUP => '#10b981',
            WorkOrder::STATUS_DELIVERED => '#06b6d4',
            WorkOrder::STATUS_WARRANTY => '#6366f1',
            WorkOrder::STATUS_ARCHIVED => '#6b7280',
        ];

        $result = [];
        foreach ($statusMap as $s => $c) {
            $result[] = [
                'status' => $s,
                'label' => $labelMap[$s] ?? $s,
                'count' => $c,
                'color' => $colorMap[$s] ?? '#666',
            ];
        }

        return $result;
    }

    private function revenueByType(\DateTimeImmutable $from, \DateTimeImmutable $to): array
    {
        $qb = $this->em->createQueryBuilder()
            ->select("CASE si.type 
                WHEN 'labor' THEN '维修工时'
                WHEN 'part' THEN '配件销售'
                WHEN 'other' THEN '其他费用'
                ELSE '未分类' END AS category")
            ->addSelect('COALESCE(SUM(CAST(si.unitPrice AS DECIMAL(10,2)) * si.quantity), 0) AS total')
            ->from(\App\Entity\ServiceItem::class, 'si')
            ->join('si.workOrder', 'wo')
            ->where('wo.status IN (:done)')
            ->andWhere('wo.actualDeliveryDate >= :from')
            ->andWhere('wo.actualDeliveryDate <= :to')
            ->setParameter('done', [WorkOrder::STATUS_DELIVERED, WorkOrder::STATUS_WARRANTY, WorkOrder::STATUS_ARCHIVED])
            ->setParameter('from', $from)
            ->setParameter('to', $to)
            ->groupBy('category');

        $byCategory = $qb->getQuery()->getScalarResult();

        $partRevenue = (float)$this->em->createQueryBuilder()
            ->select('COALESCE(SUM(CAST(pu.unitPrice AS DECIMAL(10,2)) * pu.quantity), 0)')
            ->from(\App\Entity\PartUsage::class, 'pu')
            ->join('pu.workOrder', 'wo')
            ->where('wo.status IN (:done)')
            ->andWhere('wo.actualDeliveryDate >= :from')
            ->setParameter('done', [WorkOrder::STATUS_DELIVERED, WorkOrder::STATUS_WARRANTY, WorkOrder::STATUS_ARCHIVED])
            ->setParameter('from', $from)
            ->getQuery()
            ->getSingleScalarResult();

        $laborFound = false;
        $partFound = false;
        $result = [];
        $total = 0;

        foreach ($byCategory as $r) {
            $val = (float)($r['total'] ?? 0);
            $name = $r['category'];
            if ($name === '配件销售') {
                $val = max($val, $partRevenue);
                $partFound = true;
            }
            if ($name === '维修工时') {
                $laborFound = true;
            }
            $result[] = ['name' => $name, 'value' => round($val, 2)];
            $total += $val;
        }

        if (!$partFound && $partRevenue > 0) {
            $result[] = ['name' => '配件销售', 'value' => round($partRevenue, 2)];
            $total += $partRevenue;
        }

        return [
            'period' => $from->format('Y-m-d') . ' ~ ' . $to->format('Y-m-d'),
            'total' => round($total, 2),
            'categories' => $result,
        ];
    }

    private function weeklyTrend(): array
    {
        $today = new \DateTimeImmutable();
        $days = [];
        for ($i = 13; $i >= 0; $i--) {
            $days[] = $today->modify('-' . $i . ' days');
        }

        $orderCounts = [];
        $revenues = [];
        $labels = [];

        foreach ($days as $d) {
            $dayStart = $d->setTime(0, 0, 0);
            $dayEnd = $d->setTime(23, 59, 59);
            $dateKey = $d->format('m-d');
            $labels[] = $dateKey;

            $cnt = (int)$this->orderRepo->createQueryBuilder('wo')
                ->select('COUNT(wo.id)')
                ->where('wo.intakeDate >= :ds')
                ->andWhere('wo.intakeDate <= :de')
                ->setParameter('ds', $dayStart)
                ->setParameter('de', $dayEnd)
                ->getQuery()
                ->getSingleScalarResult();
            $orderCounts[] = $cnt;

            $rev = (float)$this->orderRepo->createQueryBuilder('wo')
                ->select('COALESCE(SUM(CAST(wo.totalPrice AS DECIMAL(10,2))), 0)')
                ->where('wo.actualDeliveryDate >= :ds')
                ->andWhere('wo.actualDeliveryDate <= :de')
                ->setParameter('ds', $dayStart)
                ->setParameter('de', $dayEnd)
                ->getQuery()
                ->getSingleScalarResult();
            $revenues[] = round($rev, 2);
        }

        return [
            'labels' => $labels,
            'orderCounts' => $orderCounts,
            'revenues' => $revenues,
            'totalOrders' => array_sum($orderCounts),
            'totalRevenue' => round(array_sum($revenues), 2),
        ];
    }

    private function recentOrders(int $limit): array
    {
        $qb = $this->orderRepo->createQueryBuilder('wo')
            ->join('wo.customer', 'c')
            ->addSelect('c')
            ->orderBy('wo.updatedAt', 'DESC')
            ->setMaxResults($limit);

        $orders = $qb->getQuery()->getResult();
        $result = [];
        foreach ($orders as $o) {
            $result[] = [
                'id' => $o->getId(),
                'orderNumber' => $o->getOrderNumber(),
                'status' => $o->getStatus(),
                'brand' => $o->getBrand(),
                'model' => $o->getModel(),
                'customerName' => $o->getCustomer()?->getName(),
                'totalPrice' => (float)$o->getTotalPrice(),
                'intakeDate' => $o->getIntakeDate()?->format('Y-m-d H:i'),
                'priority' => $o->getPriority(),
            ];
        }
        return $result;
    }

    private function lowStockSummary(): array
    {
        $lowParts = $this->partsRepo->createQueryBuilder('p')
            ->select('p.id, p.name, p.sku, p.stock, p.minStock, p.unitPrice, p.category')
            ->where('p.archived = false')
            ->andWhere('p.stock <= p.minStock')
            ->orderBy('p.stock', 'ASC')
            ->setMaxResults(20)
            ->getQuery()
            ->getArrayResult();

        $totalLow = (int)$this->partsRepo->createQueryBuilder('p')
            ->select('COUNT(p.id)')
            ->where('p.archived = false')
            ->andWhere('p.stock <= p.minStock')
            ->getQuery()
            ->getSingleScalarResult();

        $critical = (int)$this->partsRepo->createQueryBuilder('p')
            ->select('COUNT(p.id)')
            ->where('p.archived = false')
            ->andWhere('p.stock = 0')
            ->getQuery()
            ->getSingleScalarResult();

        return [
            'totalLow' => $totalLow,
            'criticalZero' => $critical,
            'items' => array_map(function ($r) {
                $r['unitPrice'] = (float)($r['unitPrice'] ?? 0);
                return $r;
            }, $lowParts),
        ];
    }

    private function topTechnicians(\DateTimeImmutable $from, \DateTimeImmutable $to): array
    {
        $qb = $this->orderRepo->createQueryBuilder('wo')
            ->join('wo.assignedTechnician', 'u')
            ->select('u.id, u.name, u.role, COUNT(wo.id) AS completed')
            ->addSelect('COALESCE(SUM(CAST(wo.totalPrice AS DECIMAL(10,2))), 0) AS revenue')
            ->where('wo.status IN (:done)')
            ->andWhere('wo.actualDeliveryDate >= :from')
            ->andWhere('wo.actualDeliveryDate <= :to')
            ->setParameter('done', [WorkOrder::STATUS_DELIVERED, WorkOrder::STATUS_WARRANTY, WorkOrder::STATUS_ARCHIVED])
            ->setParameter('from', $from)
 ->setParameter('to', $to)
            ->groupBy('u.id, u.name, u.role')
            ->orderBy('revenue', 'DESC')
            ->setMaxResults(10);

        $rows = $qb->getQuery()->getScalarResult();

        return array_map(function ($r) {
            return [
                'id' => (int)$r['id'],
                'name' => $r['name'],
                'role' => $r['role'],
                'completed' => (int)$r['completed'],
                'revenue' => round((float)$r['revenue'], 2),
            ];
        }, $rows);
    }

    private function customerGrowth(): array
    {
        $today = new \DateTimeImmutable();
        $monthStart = $today->modify('first day of this month 00:00:00');
        $lastMonthStart = $today->modify('-1 month first day of 00:00:00');
        $lastMonthEnd = $today->modify('last day of previous month 23:59:59');

        $thisMonth = (int)$this->customerRepo->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.createdAt >= :ms')
            ->setParameter('ms', $monthStart)
            ->getQuery()
            ->getSingleScalarResult();

        $lastMonth = (int)$this->customerRepo->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.createdAt >= :lms')
            ->andWhere('c.createdAt <= :lme')
            ->setParameter('lms', $lastMonthStart)
            ->setParameter('lme', $lastMonthEnd)
            ->getQuery()
            ->getSingleScalarResult();

        $repeatRate = $this->calculateRepeatRate();

        return [
            'thisMonthNew' => $thisMonth,
            'lastMonthNew' => $lastMonth,
            'growthRate' => $lastMonth > 0 ? round(($thisMonth - $lastMonth) / $lastMonth * 100, 1) : null,
            'repeatRate' => $repeatRate,
        ];
    }

    private function calculateRepeatRate(): float
    {
        $sixMonthsAgo = new \DateTimeImmutable('-6 months');
        $customers = $this->customerRepo->createQueryBuilder('c')
            ->select('c.id, c.totalOrders')
            ->where('c.createdAt >= :sa')
            ->andWhere('c.totalOrders > 0')
            ->setParameter('sa', $sixMonthsAgo)
            ->getQuery()
            ->getArrayResult();

        if (count($customers) === 0) {
            return 0;
        }

        $repeat = 0;
        foreach ($customers as $c) {
            if ((int)($c['totalOrders'] ?? 0) > 1) {
                $repeat++;
            }
        }
        return round($repeat / count($customers) * 100, 1);
    }

    private function calculateAvgCycle(\DateTimeImmutable $from, \DateTimeImmutable $to): float
    {
        $qb = $this->orderRepo->createQueryBuilder('wo')
            ->select('wo.intakeDate, wo.actualDeliveryDate')
            ->where('wo.status IN (:done)')
            ->andWhere('wo.actualDeliveryDate IS NOT NULL')
            ->andWhere('wo.intakeDate IS NOT NULL')
            ->andWhere('wo.actualDeliveryDate >= :from')
            ->andWhere('wo.actualDeliveryDate <= :to')
            ->setParameter('done', [WorkOrder::STATUS_DELIVERED, WorkOrder::STATUS_WARRANTY, WorkOrder::STATUS_ARCHIVED])
            ->setParameter('from', $from)
            ->setParameter('to', $to);

        $rows = $qb->getQuery()->getArrayResult();
        if (count($rows) === 0) {
            return 0;
        }

        $totalDays = 0;
        foreach ($rows as $r) {
            if ($r['intakeDate'] && $r['actualDeliveryDate']) {
                $in = new \DateTimeImmutable($r['intakeDate']);
                $out = new \DateTimeImmutable($r['actualDeliveryDate']);
                $totalDays += $out->diff($in)->days;
            }
        }

        return round($totalDays / count($rows), 1);
    }
}
