<?php

namespace App\Service;

use App\Entity\WorkOrder;
use App\Entity\WorkOrderStatusChange;
use App\Entity\Warranty;
use App\Repository\WorkOrderRepository;
use App\Repository\CustomerRepository;
use App\Repository\PartsRepository;
use App\Repository\MovementRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Cache\CacheItemPoolInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Security\Core\Security;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class WorkOrderService
{
    private array $statusTransitions = [
        WorkOrder::STATUS_DRAFT => [
            WorkOrder::STATUS_PENDING_QUOTE,
        ],
        WorkOrder::STATUS_PENDING_QUOTE => [
            WorkOrder::STATUS_DRAFT,
            WorkOrder::STATUS_QUOTED,
        ],
        WorkOrder::STATUS_QUOTED => [
            WorkOrder::STATUS_PENDING_QUOTE,
            WorkOrder::STATUS_IN_REPAIR,
        ],
        WorkOrder::STATUS_IN_REPAIR => [
            WorkOrder::STATUS_QUOTED,
            WorkOrder::STATUS_PENDING_QA,
        ],
        WorkOrder::STATUS_PENDING_QA => [
            WorkOrder::STATUS_IN_REPAIR,
            WorkOrder::STATUS_READY_FOR_PICKUP,
        ],
        WorkOrder::STATUS_READY_FOR_PICKUP => [
            WorkOrder::STATUS_PENDING_QA,
            WorkOrder::STATUS_DELIVERED,
        ],
        WorkOrder::STATUS_DELIVERED => [
            WorkOrder::STATUS_READY_FOR_PICKUP,
            WorkOrder::STATUS_WARRANTY,
        ],
        WorkOrder::STATUS_WARRANTY => [
            WorkOrder::STATUS_DELIVERED,
            WorkOrder::STATUS_ARCHIVED,
        ],
        WorkOrder::STATUS_ARCHIVED => [
            WorkOrder::STATUS_WARRANTY,
        ],
    ];

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly WorkOrderRepository $repo,
        private readonly CustomerRepository $customerRepo,
        private readonly PartsRepository $partsRepo,
        private readonly MovementRepository $movementRepo,
        private readonly PricingService $pricingService,
        private readonly CacheItemPoolInterface $cache,
        private readonly LoggerInterface $logger,
        private readonly Security $security,
    ) {}

    public function list(array $filters = [], int $page = 1, int $pageSize = 20): array
    {
        $cacheKey = sprintf('wo_list_%s_%d_%d', md5(json_encode($filters)), $page, $pageSize);
        $cacheItem = $this->cache->getItem($cacheKey);

        if ($cacheItem->isHit()) {
            return $cacheItem->get();
        }

        $qb = $this->repo->createQueryBuilder('wo')
            ->leftJoin('wo.customer', 'c')
            ->addSelect('c');

        if (!empty($filters['status'])) {
            $qb->andWhere('wo.status IN (:statuses)')
                ->setParameter('statuses', (array)$filters['status']);
        }

        if (!empty($filters['keyword'])) {
            $keyword = '%' . $filters['keyword'] . '%';
            $qb->andWhere(
                $qb->expr()->orX(
                    'wo.orderNumber LIKE :kw',
                    'wo.brand LIKE :kw',
                    'wo.model LIKE :kw',
                    'wo.caseSerialNumber LIKE :kw',
                    'c.name LIKE :kw',
                    'c.phone LIKE :kw'
                )
            )->setParameter('kw', $keyword);
        }

        if (!empty($filters['dateFrom'])) {
            $qb->andWhere('wo.intakeDate >= :from')
                ->setParameter('from', new \DateTimeImmutable($filters['dateFrom']));
        }

        if (!empty($filters['dateTo'])) {
            $qb->andWhere('wo.intakeDate <= :to')
                ->setParameter('to', new \DateTimeImmutable($filters['dateTo']));
        }

        if (!empty($filters['technicianId'])) {
            $qb->andWhere('wo.assignedTechnician = :tid')
                ->setParameter('tid', $filters['technicianId']);
        }

        if (!empty($filters['priority'])) {
            $qb->andWhere('wo.priority = :p')
                ->setParameter('p', $filters['priority']);
        }

        if (!empty($filters['customerId'])) {
            $qb->andWhere('wo.customer = :cid')
                ->setParameter('cid', $filters['customerId']);
        }

        $qb->orderBy('wo.createdAt', 'DESC');

        $total = (clone $qb)->select('COUNT(DISTINCT wo.id)')
            ->getQuery()
            ->getSingleScalarResult();

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
        ];

        $cacheItem->set($result);
        $cacheItem->expiresAfter(300);
        $this->cache->save($cacheItem);

        return $result;
    }

    public function create(array $data): WorkOrder
    {
        $workOrder = new WorkOrder();

        $customerData = $data['customer'] ?? [];
        $customer = null;

        if (!empty($data['customerId'])) {
            $customer = $this->customerRepo->find($data['customerId']);
        }

        if (!$customer && !empty($customerData['phone'])) {
            $customer = $this->customerRepo->findOneBy(['phone' => $customerData['phone']]);
            if ($customer) {
                if (!empty($customerData['name']) && $customer->getName() !== $customerData['name']) {
                    // existing but different name, create new to avoid confusion
                    $customer = null;
                }
            }
        }

        if (!$customer && !empty($customerData)) {
            $customer = new \App\Entity\Customer();
            $customer->setName($customerData['name'] ?? '未知客户');
            $customer->setPhone($customerData['phone'] ?? '');
            if (!empty($customerData['email'])) {
                $customer->setEmail($customerData['email']);
            }
            if (!empty($customerData['address'])) {
                $customer->setAddress($customerData['address']);
            }
            $this->em->persist($customer);
        }

        if (!$customer) {
            throw new BadRequestHttpException('客户信息缺失');
        }

        $customer->incrementTotalOrders();
        $workOrder->setCustomer($customer);

        $fields = [
            'brand', 'model', 'caseSerialNumber', 'movementSerialNumber',
            'movementCode', 'problemDescription', 'customerNotes', 'internalNotes',
            'deposit', 'warrantyMonths', 'priority',
        ];

        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $method = 'set' . ucfirst($field);
                $workOrder->$method($data[$field]);
            }
        }

        if (!empty($data['intakeDate'])) {
            $workOrder->setIntakeDate(new \DateTimeImmutable($data['intakeDate']));
        }

        if (!empty($data['estimatedDeliveryDate'])) {
            $workOrder->setEstimatedDeliveryDate(new \DateTimeImmutable($data['estimatedDeliveryDate']));
        }

        if (!empty($data['movementCode'])) {
            $movement = $this->movementRepo->findOneBy(['code' => $data['movementCode']]);
            if ($movement) {
                $workOrder->setMovement($movement);
            }
        }

        $repeatInfo = $this->checkRepeatVisit(
            $workOrder->getCaseSerialNumber(),
            $customer->getName()
        );
        if ($repeatInfo['isRepeat']) {
            $workOrder->setRepeatVisit(true);
            $workOrder->setPreviousOrder($repeatInfo['previousOrders'][0] ?? null);
        }

        if (isset($data['laborPrice'])) {
            $workOrder->setLaborPrice(number_format((float)$data['laborPrice'], 2, '.', ''));
        }
        if (isset($data['partsPrice'])) {
            $workOrder->setPartsPrice(number_format((float)$data['partsPrice'], 2, '.', ''));
        }
        if (isset($data['totalPrice'])) {
            $workOrder->setTotalPrice(number_format((float)$data['totalPrice'], 2, '.', ''));
        }

        if (!isset($data['totalPrice'])) {
            $quote = $this->pricingService->calculateQuote($workOrder);
            $workOrder->setLaborPrice(number_format($quote['laborPrice'], 2, '.', ''));
            $workOrder->setPartsPrice(number_format($quote['partsPrice'], 2, '.', ''));
            $workOrder->setTotalPrice(number_format($quote['totalPrice'], 2, '.', ''));
        }

        $workOrder->setStatus(WorkOrder::STATUS_DRAFT);
        $workOrder->addLogEntry('创建工单', '工单创建成功', $this->getCurrentUser());

        if ($workOrder->getStatus() === WorkOrder::STATUS_DRAFT) {
            $workOrder->setStatus(WorkOrder::STATUS_PENDING_QUOTE);
            $workOrder->addLogEntry('状态变更', '草稿→待报价', $this->getCurrentUser());
        }

        $this->em->persist($workOrder);
        $this->em->flush();
        $this->invalidateListCache();

        $this->logger->info('Work order created', [
            'id' => $workOrder->getId(),
            'number' => $workOrder->getOrderNumber(),
            'customer' => $customer->getName(),
        ]);

        return $workOrder;
    }

    public function update(int $id, array $data): WorkOrder
    {
        $workOrder = $this->repo->find($id);
        if (!$workOrder) {
            throw new NotFoundHttpException('工单不存在');
        }

        $fields = [
            'brand', 'model', 'caseSerialNumber', 'movementSerialNumber',
            'movementCode', 'problemDescription', 'customerNotes', 'internalNotes',
            'laborPrice', 'partsPrice', 'totalPrice', 'deposit',
            'warrantyMonths', 'priority',
        ];

        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $method = 'set' . ucfirst($field);
                if (in_array($field, ['laborPrice', 'partsPrice', 'totalPrice', 'deposit'], true)) {
                    $workOrder->$method(number_format((float)$data[$field], 2, '.', ''));
                } else {
                    $workOrder->$method($data[$field]);
                }
            }
        }

        if (!empty($data['estimatedDeliveryDate'])) {
            $workOrder->setEstimatedDeliveryDate(new \DateTimeImmutable($data['estimatedDeliveryDate']));
        }
        if (!empty($data['movementCode'])) {
            $movement = $this->movementRepo->findOneBy(['code' => $data['movementCode']]);
            if ($movement) {
                $workOrder->setMovement($movement);
            }
        }

        $workOrder->addLogEntry('编辑工单', '工单信息已更新', $this->getCurrentUser());
        $this->em->flush();
        $this->invalidateListCache();

        return $workOrder;
    }

    public function get(int $id): WorkOrder
    {
        $cacheKey = 'wo_detail_' . $id;
        $cacheItem = $this->cache->getItem($cacheKey);

        if ($cacheItem->isHit()) {
            return $cacheItem->get();
        }

        $workOrder = $this->repo->find($id);
        if (!$workOrder) {
            throw new NotFoundHttpException('工单不存在');
        }

        $cacheItem->set($workOrder);
        $cacheItem->expiresAfter(300);
        $this->cache->save($cacheItem);

        return $workOrder;
    }

    public function changeStatus(int $id, string $newStatus, ?string $note = null): WorkOrder
    {
        $workOrder = $this->repo->find($id);
        if (!$workOrder) {
            throw new NotFoundHttpException('工单不存在');
        }

        $oldStatus = $workOrder->getStatus();
        $user = $this->getCurrentUser();

        if ($oldStatus === $newStatus) {
            return $workOrder;
        }

        if ($user && !in_array('ROLE_ADMIN', $user->getRoles(), true)) {
            $allowed = $this->statusTransitions[$oldStatus] ?? [];
            if (!in_array($newStatus, $allowed, true)) {
                throw new AccessDeniedHttpException(
                    sprintf('不允许从状态 %s 变更到 %s', $oldStatus, $newStatus)
                );
            }
        }

        $workOrder->setStatus($newStatus);
        $logDetail = sprintf('状态变更：%s → %s', $this->statusLabel($oldStatus), $this->statusLabel($newStatus));
        if ($note) {
            $logDetail .= "\n备注：" . $note;
        }
        $workOrder->addLogEntry($this->statusLabel($newStatus), $logDetail, $user);

        switch ($newStatus) {
            case WorkOrder::STATUS_QUOTED:
                $this->pricingService->applyQuoteToOrder($workOrder);
                break;

            case WorkOrder::STATUS_DELIVERED:
                $workOrder->setActualDeliveryDate(new \DateTimeImmutable());
                break;

            case WorkOrder::STATUS_WARRANTY:
                $this->createWarranty($workOrder);
                break;
        }

        $this->em->flush();
        $this->invalidateDetailCache($id);
        $this->invalidateListCache();

        return $workOrder;
    }

    public function checkRepeatVisit(string $caseSerial, string $customerName): array
    {
        if (!$caseSerial || !$customerName) {
            return ['isRepeat' => false, 'previousOrders' => []];
        }

        $sixMonthsAgo = new \DateTimeImmutable('-6 months');

        $qb = $this->repo->createQueryBuilder('wo')
            ->join('wo.customer', 'c')
            ->where('wo.caseSerialNumber = :serial')
            ->andWhere('c.name = :name')
            ->andWhere('wo.createdAt >= :since')
            ->setParameter('serial', $caseSerial)
            ->setParameter('name', $customerName)
            ->setParameter('since', $sixMonthsAgo)
            ->orderBy('wo.createdAt', 'DESC')
            ->setMaxResults(10);

        $orders = $qb->getQuery()->getResult();

        return [
            'isRepeat' => count($orders) > 0,
            'previousOrders' => $orders,
        ];
    }

    public function addPartUsage(int $orderId, int $partId, int $quantity, ?string $batchNumber = null): \App\Entity\PartUsage
    {
        $workOrder = $this->repo->find($orderId);
        if (!$workOrder) {
            throw new NotFoundHttpException('工单不存在');
        }

        $part = $this->partsRepo->find($partId);
        if (!$part) {
            throw new NotFoundHttpException('配件不存在');
        }

        if ($part->getStock() < $quantity) {
            throw new BadRequestHttpException(sprintf(
                '库存不足：%s 仅剩 %d 件，需要 %d 件',
                $part->getName(),
                $part->getStock(),
                $quantity
            ));
        }

        $part->adjustStock(-$quantity);

        $usage = new \App\Entity\PartUsage();
        $usage->setWorkOrder($workOrder);
        $usage->setPart($part);
        $usage->setQuantity($quantity);
        $usage->setBatchNumber($batchNumber);
        $usage->setTechnician($this->getCurrentUser());
        $usage->setUnitPrice($part->getUnitPrice());

        $this->em->persist($usage);
        $workOrder->addPartUsage($usage);

        $partsTotal = 0;
        foreach ($workOrder->getPartUsages() as $pu) {
            $partsTotal += (float)$pu->getUnitPrice() * $pu->getQuantity();
        }
        $workOrder->setPartsPrice(number_format($partsTotal, 2, '.', ''));
        $workOrder->setTotalPrice(
            number_format((float)$workOrder->getLaborPrice() + $partsTotal, 2, '.', '')
        );

        $workOrder->addLogEntry(
            '配件出库',
            sprintf('出库：%s x%d（批号：%s）', $part->getName(), $quantity, $batchNumber ?: '无'),
            $this->getCurrentUser()
        );

        $this->em->flush();
        $this->invalidateDetailCache($orderId);

        return $usage;
    }

    public function removePartUsage(int $orderId, int $usageId): void
    {
        $workOrder = $this->repo->find($orderId);
        if (!$workOrder) {
            throw new NotFoundHttpException('工单不存在');
        }

        $usage = $this->em->getRepository(\App\Entity\PartUsage::class)->find($usageId);
        if (!$usage || $usage->getWorkOrder()->getId() !== $orderId) {
            throw new NotFoundHttpException('配件使用记录不存在');
        }

        $part = $usage->getPart();
        if ($part) {
            $part->adjustStock($usage->getQuantity());
        }

        $workOrder->removePartUsage($usage);
        $this->em->remove($usage);

        $partsTotal = 0;
        foreach ($workOrder->getPartUsages() as $pu) {
            $partsTotal += (float)$pu->getUnitPrice() * $pu->getQuantity();
        }
        $workOrder->setPartsPrice(number_format($partsTotal, 2, '.', ''));
        $workOrder->setTotalPrice(
            number_format((float)$workOrder->getLaborPrice() + $partsTotal, 2, '.', '')
        );

        $workOrder->addLogEntry(
            '配件退回',
            sprintf('退回：%s x%d', $usage->getPart()?->getName() ?? '未知', $usage->getQuantity()),
            $this->getCurrentUser()
        );

        $this->em->flush();
        $this->invalidateDetailCache($orderId);
    }

    public function saveInspection(int $orderId, array $data): \App\Entity\Inspection
    {
        $workOrder = $this->repo->find($orderId);
        if (!$workOrder) {
            throw new NotFoundHttpException('工单不存在');
        }

        $inspection = $workOrder->getInspection();
        if (!$inspection) {
            $inspection = new \App\Entity\Inspection();
            $workOrder->setInspection($inspection);
            $this->em->persist($inspection);
        }

        $fields = [
            'frequency', 'amplitude', 'rate', 'beatError', 'powerReserve',
            'waterResistance', 'dialCondition', 'caseCondition', 'bandCondition',
            'crownFunction', 'pushersFunction', 'dateFunction', 'chronographFunction', 'notes'
        ];

        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $method = 'set' . ucfirst($field);
                $inspection->$method($data[$field]);
            }
        }

        $workOrder->addLogEntry('保存检测数据', '机芯检测数据已更新', $this->getCurrentUser());

        $this->em->flush();
        $this->invalidateDetailCache($orderId);

        return $inspection;
    }

    public function generateQrToken(string $orderNumber): array
    {
        $workOrder = $this->repo->findOneBy(['orderNumber' => $orderNumber]);
        if (!$workOrder) {
            throw new NotFoundHttpException('工单不存在');
        }

        $token = bin2hex(random_bytes(16));
        $cacheKey = 'qr_token_' . $token;
        $cacheItem = $this->cache->getItem($cacheKey);
        $cacheItem->set(['orderId' => $workOrder->getId(), 'orderNumber' => $orderNumber]);
        $cacheItem->expiresAfter(86400 * 30);
        $this->cache->save($cacheItem);

        return [
            'token' => $token,
            'url' => sprintf('/public/intake/%s', $token),
        ];
    }

    public function createWarranty(WorkOrder $order): Warranty
    {
        if ($order->getWarranty()) {
            return $order->getWarranty();
        }

        $startDate = $order->getActualDeliveryDate() ?? new \DateTimeImmutable();
        $endDate = $startDate->modify(sprintf('+%d months', $order->getWarrantyMonths()));

        $warranty = new Warranty();
        $warranty->setWorkOrder($order);
        $warranty->setCustomer($order->getCustomer());
        $warranty->setStartDate($startDate);
        $warranty->setEndDate($endDate);
        $warranty->setMonths($order->getWarrantyMonths());
        $warranty->setStatus(Warranty::STATUS_ACTIVE);

        $this->em->persist($warranty);
        $order->setWarranty($warranty);
        $order->addLogEntry(
            '生成质保证书',
            sprintf('质保期限：%d 个月，至 %s 止', $order->getWarrantyMonths(), $endDate->format('Y-m-d')),
            $this->getCurrentUser()
        );

        return $warranty;
    }

    private function getCurrentUser(): ?\App\Entity\User
    {
        $user = $this->security->getUser();
        return $user instanceof \App\Entity\User ? $user : null;
    }

    private function statusLabel(string $status): string
    {
        $labels = [
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
        return $labels[$status] ?? $status;
    }

    private function invalidateListCache(): void
    {
        $this->cache->clear();
    }

    private function invalidateDetailCache(int $id): void
    {
        $this->cache->deleteItem('wo_detail_' . $id);
    }
}
