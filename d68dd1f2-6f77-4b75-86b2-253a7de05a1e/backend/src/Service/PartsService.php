<?php

namespace App\Service;

use App\Entity\Parts;
use App\Entity\PartCategory;
use App\Repository\PartsRepository;
use App\Repository\PartCategoryRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Cache\CacheItemPoolInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Security\Core\Security;

class PartsService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PartsRepository $partsRepo,
        private readonly PartCategoryRepository $categoryRepo,
        private readonly CacheItemPoolInterface $cache,
        private readonly LoggerInterface $logger,
        private readonly Security $security,
    ) {}

    public function list(array $filters = [], int $page = 1, int $pageSize = 50): array
    {
        $qb = $this->partsRepo->createQueryBuilder('p')
            ->leftJoin('p.category', 'cat')
            ->addSelect('cat');

        if (!empty($filters['keyword'])) {
            $kw = '%' . $filters['keyword'] . '%';
            $qb->andWhere(
                $qb->expr()->orX(
                    'p.name LIKE :kw',
                    'p.sku LIKE :kw',
                    'p.barcode LIKE :kw',
                    'p.brand LIKE :kw',
                    'p.description LIKE :kw'
                )
            )->setParameter('kw', $kw);
        }

        if (!empty($filters['categoryId'])) {
            $qb->andWhere('p.category = :cid')
                ->setParameter('cid', $filters['categoryId']);
        }

        if (!empty($filters['movementCode'])) {
            $mc = '%' . $filters['movementCode'] . '%';
            $qb->andWhere('p.compatibleMovements LIKE :mc')
                ->setParameter('mc', $mc);
        }

        if (!empty($filters['lowStockOnly'])) {
            $qb->andWhere('p.stock <= p.minStock');
        }

        if (!empty($filters['shelf'])) {
            $qb->andWhere('p.shelf LIKE :sh')
                ->setParameter('sh', '%' . $filters['shelf'] . '%');
        }

        if (!empty($filters['brand'])) {
            $qb->andWhere('p.brand = :brand')
                ->setParameter('brand', $filters['brand']);
        }

        $qb->orderBy('p.name', 'ASC');

        $total = (clone $qb)->select('COUNT(p.id)')->getQuery()->getSingleScalarResult();

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

    public function create(array $data): Parts
    {
        $part = new Parts();

        $fields = [
            'sku', 'barcode', 'name', 'brand', 'description', 'specs',
            'compatibleMovements', 'categoryId', 'unitPrice', 'costPrice',
            'stock', 'minStock', 'reorderQty', 'shelf', 'location', 'notes',
        ];

        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $method = 'set' . ucfirst($field);
                if ($field === 'categoryId') {
                    if ($data[$field]) {
                        $cat = $this->categoryRepo->find($data[$field]);
                        if ($cat) {
                            $part->setCategory($cat);
                        }
                    }
                } elseif ($field === 'unitPrice' || $field === 'costPrice') {
                    $part->$method(number_format((float)$data[$field], 2, '.', ''));
                } else {
                    $part->$method($data[$field]);
                }
            }
        }

        $this->em->persist($part);
        $this->em->flush();
        $this->invalidateCache();

        $this->logger->info('Part created', [
            'id' => $part->getId(),
            'sku' => $part->getSku(),
            'name' => $part->getName(),
        ]);

        return $part;
    }

    public function update(int $id, array $data): Parts
    {
        $part = $this->partsRepo->find($id);
        if (!$part) {
            throw new NotFoundHttpException('配件不存在');
        }

        $fields = [
            'sku', 'barcode', 'name', 'brand', 'description', 'specs',
            'compatibleMovements', 'unitPrice', 'costPrice',
            'stock', 'minStock', 'reorderQty', 'shelf', 'location', 'notes',
        ];

        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $method = 'set' . ucfirst($field);
                if ($field === 'unitPrice' || $field === 'costPrice') {
                    $part->$method(number_format((float)$data[$field], 2, '.', ''));
                } else {
                    $part->$method($data[$field]);
                }
            }
        }

        if (isset($data['categoryId'])) {
            if ($data['categoryId']) {
                $cat = $this->categoryRepo->find($data['categoryId']);
                if ($cat) {
                    $part->setCategory($cat);
                }
            } else {
                $part->setCategory(null);
            }
        }

        $this->em->flush();
        $this->invalidateCache();

        return $part;
    }

    public function delete(int $id): void
    {
        $part = $this->partsRepo->find($id);
        if (!$part) {
            throw new NotFoundHttpException('配件不存在');
        }

        $usedCount = $this->em->getRepository(\App\Entity\PartUsage::class)
            ->createQueryBuilder('pu')
            ->select('COUNT(pu.id)')
            ->where('pu.part = :pid')
            ->setParameter('pid', $id)
            ->getQuery()
            ->getSingleScalarResult();

        if ($usedCount > 0) {
            $part->setArchived(true);
            $this->em->flush();
        } else {
            $this->em->remove($part);
            $this->em->flush();
        }

        $this->invalidateCache();
    }

    public function adjustStock(int $id, int $delta, string $reason): Parts
    {
        $part = $this->partsRepo->find($id);
        if (!$part) {
            throw new NotFoundHttpException('配件不存在');
        }

        $oldStock = $part->getStock();
        $part->adjustStock($delta);
        $this->em->flush();
        $this->invalidateCache();

        $this->logger->info('Stock adjusted', [
            'part' => $part->getSku(),
            'oldStock' => $oldStock,
            'newStock' => $part->getStock(),
            'delta' => $delta,
            'reason' => $reason,
            'user' => $this->security->getUser()?->getUserIdentifier() ?? 'system',
        ]);

        return $part;
    }

    public function getLowStockParts(): array
    {
        $cacheKey = 'parts_low_stock';
        $cacheItem = $this->cache->getItem($cacheKey);

        if ($cacheItem->isHit()) {
            return $cacheItem->get();
        }

        $qb = $this->partsRepo->createQueryBuilder('p')
            ->where('p.archived = false')
            ->andWhere('p.stock <= p.minStock')
            ->orderBy('p.stock', 'ASC')
            ->setMaxResults(100);

        $parts = $qb->getQuery()->getResult();

        $cacheItem->set($parts);
        $cacheItem->expiresAfter(180);
        $this->cache->save($cacheItem);

        return $parts;
    }

    public function getShelfMap(): array
    {
        $cacheKey = 'parts_shelf_map';
        $cacheItem = $this->cache->getItem($cacheKey);

        if ($cacheItem->isHit()) {
            return $cacheItem->get();
        }

        $all = $this->partsRepo->createQueryBuilder('p')
            ->select('p.shelf, COUNT(p.id) AS cnt, SUM(CASE WHEN p.stock <= p.minStock THEN 1 ELSE 0 END) AS lowCnt')
            ->where('p.archived = false')
            ->andWhere('p.shelf IS NOT NULL')
            ->andWhere('p.shelf <> \'\'')
            ->groupBy('p.shelf')
            ->orderBy('p.shelf', 'ASC')
            ->getQuery()
            ->getResult();

        $map = [];
        foreach ($all as $row) {
            $shelf = $row['shelf'] ?? '未分类';
            $partsInShelf = $this->partsRepo->findBy(['shelf' => $shelf, 'archived' => false]);
            $map[$shelf] = [
                'shelf' => $shelf,
                'totalCount' => (int)$row['cnt'],
                'lowStockCount' => (int)($row['lowCnt'] ?? 0),
                'parts' => $partsInShelf,
            ];
        }

        $cacheItem->set($map);
        $cacheItem->expiresAfter(300);
        $this->cache->save($cacheItem);

        return $map;
    }

    private function invalidateCache(): void
    {
        $this->cache->deleteItem('parts_low_stock');
        $this->cache->deleteItem('parts_shelf_map');
    }
}
