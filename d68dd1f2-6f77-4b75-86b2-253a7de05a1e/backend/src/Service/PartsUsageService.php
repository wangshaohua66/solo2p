<?php

namespace App\Service;

use App\Repository\PartsRepository;
use App\Repository\WorkOrderRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Cache\CacheItemPoolInterface;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Serializer\SerializerInterface;

class PartsUsageService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PartsRepository $partsRepo,
        private readonly WorkOrderRepository $orderRepo,
        private readonly CacheItemPoolInterface $cache,
        private readonly SerializerInterface $serializer,
    ) {}

    public function scanAndUse(string $barcode, int $workOrderId, int $quantity, ?string $batchNumber = null): array
    {
        if (empty($barcode)) {
            throw new BadRequestHttpException('条码不能为空');
        }
        if ($workOrderId <= 0) {
            throw new BadRequestHttpException('工单号无效');
        }
        if ($quantity <= 0) {
            throw new BadRequestHttpException('数量必须大于0');
        }

        $barcodeCacheKey = 'parts_barcode_' . md5($barcode);
        $cacheItem = $this->cache->getItem($barcodeCacheKey);

        if ($cacheItem->isHit()) {
            $partId = (int)$cacheItem->get();
        } else {
            $part = $this->partsRepo->findOneBy(['barcode' => $barcode]);
            if (!$part) {
                $part = $this->partsRepo->findOneBy(['sku' => $barcode]);
            }
            if (!$part) {
                throw new NotFoundHttpException('未找到条码对应的配件：' . $barcode);
            }
            $partId = $part->getId();
            $cacheItem->set((string)$partId);
            $cacheItem->expiresAfter(3600);
            $this->cache->save($cacheItem);
            $part = $this->partsRepo->find($partId);
        }

        if (!isset($part)) {
            $part = $this->partsRepo->find($partId);
        }
        if (!$part) {
            throw new NotFoundHttpException('配件不存在');
        }

        $order = $this->orderRepo->find($workOrderId);
        if (!$order) {
            throw new NotFoundHttpException('工单不存在');
        }

        if ($part->getStock() < $quantity) {
            return [
                'success' => false,
                'error' => '库存不足',
                'part' => json_decode($this->serializer->serialize($part, 'json', [
                    'groups' => ['parts:read'],
                    'circular_reference_handler' => fn($o) => $o->getId(),
                ]), true),
                'required' => $quantity,
                'available' => $part->getStock(),
            ];
        }

        $part->adjustStock(-$quantity);

        $usage = new \App\Entity\PartUsage();
        $usage->setWorkOrder($order);
        $usage->setPart($part);
        $usage->setQuantity($quantity);
        $usage->setBatchNumber($batchNumber);
        $usage->setUnitPrice($part->getUnitPrice());
        $this->em->persist($usage);

        $order->addPartUsage($usage);

        $partsTotal = 0;
        foreach ($order->getPartUsages() as $pu) {
            $partsTotal += (float)$pu->getUnitPrice() * $pu->getQuantity();
        }
        $order->setPartsPrice(number_format($partsTotal, 2, '.', ''));
        $order->setTotalPrice(
            number_format((float)$order->getLaborPrice() + $partsTotal, 2, '.', '')
        );

        $this->em->flush();

        $this->cache->deleteItem('parts_low_stock');
        $this->cache->deleteItem('wo_detail_' . $workOrderId);

        return [
            'success' => true,
            'part' => json_decode($this->serializer->serialize($part, 'json', [
                'groups' => ['parts:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true),
            'usage' => json_decode($this->serializer->serialize($usage, 'json', [
                'groups' => ['workorder:read'],
            ]), true),
            'newStock' => $part->getStock(),
            'subtotal' => (float)$part->getUnitPrice() * $quantity,
            'isLowStock' => $part->isLowStock(),
        ];
    }

    public function history(array $filters = [], int $page = 1, int $pageSize = 50): array
    {
        $qb = $this->em->createQueryBuilder()
            ->select('pu')
            ->from(\App\Entity\PartUsage::class, 'pu')
            ->leftJoin('pu.part', 'p')
            ->addSelect('p')
            ->leftJoin('pu.workOrder', 'wo')
            ->addSelect('wo');

        if (!empty($filters['partId'])) {
            $qb->andWhere('pu.part = :pid')->setParameter('pid', $filters['partId']);
        }
        if (!empty($filters['workOrderId'])) {
            $qb->andWhere('pu.workOrder = :wid')->setParameter('wid', $filters['workOrderId']);
        }
        if (!empty($filters['dateFrom'])) {
            $qb->andWhere('pu.usedAt >= :from')->setParameter('from', new \DateTimeImmutable($filters['dateFrom']));
        }
        if (!empty($filters['dateTo'])) {
            $qb->andWhere('pu.usedAt <= :to')->setParameter('to', new \DateTimeImmutable($filters['dateTo']));
        }

        $qb->orderBy('pu.usedAt', 'DESC');

        $total = (clone $qb)->select('COUNT(pu.id)')->getQuery()->getSingleScalarResult();

        $offset = ($page - 1) * $pageSize;
        $data = $qb->setFirstResult($offset)
            ->setMaxResults($pageSize)
            ->getQuery()
            ->getResult();

        return [
            'data' => $data,
            'total' => (int)$total,
            'page' => $page,
            'pageSize' => $pageSize,
        ];
    }
}
