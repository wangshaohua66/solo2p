<?php

namespace App\Service;

use App\Entity\Movement;
use App\Entity\WorkOrder;
use App\Entity\PartUsage;
use App\Repository\MovementRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;

class PricingService
{
    private array $laborRateMap = [
        'basic_cleaning' => 1.5,
        'standard_service' => 0,
        'complete_overhaul' => 0,
        'case_polish' => 1.0,
        'band_refurbish' => 0.8,
        'waterproof_test' => 0.5,
        'pressure_test' => 0.3,
        'regulation' => 0.8,
        'dial_restoration' => 3.0,
    ];

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly MovementRepository $movementRepo,
        private readonly LoggerInterface $logger,
        private readonly int $laborRatePerHour = 300
    ) {}

    public function calculateQuote(WorkOrder $order): array
    {
        $laborPrice = 0.0;
        $partsPrice = 0.0;
        $items = [];

        $movement = $order->getMovement();
        if (!$movement && $order->getMovementCode()) {
            $movement = $this->movementRepo->findOneBy(['code' => $order->getMovementCode()]);
        }

        if ($movement) {
            $laborHours = (float)$movement->getStandardLaborHours();
            $laborPrice = $laborHours * $this->laborRatePerHour;
            $items[] = [
                'type' => 'labor',
                'name' => sprintf('%s %s - 机芯保养服务', $movement->getBrand(), $movement->getCode()),
                'quantity' => 1,
                'unitPrice' => (float)$this->laborRatePerHour,
                'hours' => $laborHours,
                'subtotal' => $laborPrice,
                'description' => sprintf(
                    '包含%s等标准保养步骤',
                    implode('、', array_slice($movement->getServiceSteps(), 0, 3))
                )
            ];
        } else {
            $baseLabor = 4.0;
            $laborPrice = $baseLabor * $this->laborRatePerHour;
            $items[] = [
                'type' => 'labor',
                'name' => '基础机芯检测与保养',
                'quantity' => 1,
                'unitPrice' => (float)$this->laborRatePerHour,
                'hours' => $baseLabor,
                'subtotal' => $laborPrice,
                'description' => '标准基础保养工时计费'
            ];
        }

        if ($order->getPriority() === WorkOrder::PRIORITY_URGENT) {
            $urgentFee = $laborPrice * 0.3;
            $laborPrice += $urgentFee;
            $items[] = [
                'type' => 'labor',
                'name' => '加急处理费',
                'quantity' => 1,
                'unitPrice' => $urgentFee,
                'subtotal' => $urgentFee,
                'description' => '30%加急费率'
            ];
        } elseif ($order->getPriority() === WorkOrder::PRIORITY_EXPRESS) {
            $expressFee = $laborPrice * 0.6;
            $laborPrice += $expressFee;
            $items[] = [
                'type' => 'labor',
                'name' => '特快处理费',
                'quantity' => 1,
                'unitPrice' => $expressFee,
                'subtotal' => $expressFee,
                'description' => '60%特快费率，优先处理'
            ];
        }

        $problem = mb_strtolower($order->getProblemDescription() ?? '');
        $extraServices = $this->detectExtraServices($problem);
        foreach ($extraServices as $service) {
            $price = $service['hours'] * $this->laborRatePerHour;
            $laborPrice += $price;
            $items[] = [
                'type' => 'labor',
                'name' => $service['name'],
                'quantity' => 1,
                'unitPrice' => (float)$this->laborRatePerHour,
                'hours' => $service['hours'],
                'subtotal' => $price,
                'description' => $service['description'] ?? ''
            ];
        }

        foreach ($order->getPartUsages() as $usage) {
            $subtotal = (float)$usage->getUnitPrice() * $usage->getQuantity();
            $partsPrice += $subtotal;
            $items[] = [
                'type' => 'part',
                'name' => $usage->getPart()?->getName() ?? '配件',
                'quantity' => $usage->getQuantity(),
                'unitPrice' => (float)$usage->getUnitPrice(),
                'subtotal' => $subtotal,
                'sku' => $usage->getPart()?->getSku(),
                'batchNumber' => $usage->getBatchNumber()
            ];
        }

        $totalPrice = $laborPrice + $partsPrice;

        return [
            'laborPrice' => round($laborPrice, 2),
            'partsPrice' => round($partsPrice, 2),
            'totalPrice' => round($totalPrice, 2),
            'deposit' => round($totalPrice * 0.3, 2),
            'items' => $items,
            'breakdown' => [
                'laborHours' => array_reduce(
                    array_filter($items, fn($i) => $i['type'] === 'labor'),
                    fn($s, $i) => $s + ($i['hours'] ?? 0),
                    0
                ),
                'laborRate' => $this->laborRatePerHour,
                'partCount' => $order->getPartUsages()->count()
            ]
        ];
    }

    public function applyQuoteToOrder(WorkOrder $order): WorkOrder
    {
        $quote = $this->calculateQuote($order);
        $order->setLaborPrice(number_format($quote['laborPrice'], 2, '.', ''));
        $order->setPartsPrice(number_format($quote['partsPrice'], 2, '.', ''));
        $order->setTotalPrice(number_format($quote['totalPrice'], 2, '.', ''));

        foreach ($quote['items'] as $item) {
            $existing = $order->getServiceItems()->filter(function ($si) use ($item) {
                return $si->getName() === $item['name'] && $si->getType() === $item['type'];
            });
            if ($existing->count() === 0) {
                $serviceItem = new \App\Entity\ServiceItem();
                $serviceItem->setType($item['type']);
                $serviceItem->setName($item['name']);
                $serviceItem->setQuantity($item['quantity']);
                $serviceItem->setUnitPrice(number_format($item['unitPrice'], 2, '.', ''));
                if (isset($item['description'])) {
                    $serviceItem->setDescription($item['description']);
                }
                $order->addServiceItem($serviceItem);
                $this->em->persist($serviceItem);
            }
        }

        return $order;
    }

    private function detectExtraServices(string $problem): array
    {
        $services = [];

        if (preg_match('/抛光|翻新|划痕|打磨/', $problem)) {
            $services[] = [
                'name' => '表壳抛光翻新',
                'hours' => 1.5,
                'description' => '表壳外观划痕修复与高抛光处理'
            ];
        }

        if (preg_match('/表带|表链|表扣/', $problem)) {
            $services[] = [
                'name' => '表带翻新保养',
                'hours' => 0.8,
                'description' => '表带清洁、除锈、润滑处理'
            ];
        }

        if (preg_match('/进水|水汽|雾气|防水/', $problem)) {
            $services[] = [
                'name' => '防水修复与检测',
                'hours' => 1.0,
                'description' => '更换防水圈、真空防水测试'
            ];
        }

        if (preg_match('/表盘|刻度|夜光点|字面/', $problem)) {
            $services[] = [
                'name' => '表盘修复/翻新',
                'hours' => 3.0,
                'description' => '表盘清洁、刻度修复、夜光点重涂'
            ];
        }

        if (preg_match('/把的|表冠|上链|旋入/', $problem)) {
            $services[] = [
                'name' => '表冠/把的维修',
                'hours' => 0.8,
                'description' => '表冠机构清理、防水管更换'
            ];
        }

        if (preg_match('/日历|星期|月份|万年历/', $problem)) {
            $services[] = [
                'name' => '历机构调校',
                'hours' => 1.5,
                'description' => '日历/星期跳历机构检修调校'
            ];
        }

        if (preg_match('/计时|码表|追针|计时功能/', $problem)) {
            $services[] = [
                'name' => '计时机芯调校',
                'hours' => 2.0,
                'description' => '计时模块清洁、凸轮调校、零点对齐'
            ];
        }

        if (preg_match('/玻璃|表蒙|蓝宝石|镜面/', $problem)) {
            $services[] = [
                'name' => '表镜更换/抛光',
                'hours' => 0.5,
                'description' => '表镜划痕处理或更换蓝宝石玻璃'
            ];
        }

        return $services;
    }

    public function getLaborRatePerHour(): int
    {
        return $this->laborRatePerHour;
    }
}
