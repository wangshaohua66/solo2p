<?php

namespace App\Controller;

use App\Document\ConcessionSku;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class ConcessionController extends AbstractApiController
{
    public function __construct(private DocumentManager $dm)
    {
    }

    #[Route('/api/concessions', name: 'api_concession_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $category = $request->query->get('category');
        $status = $request->query->get('status');
        $cinemaId = $request->query->get('cinemaId');
        $keyword = $request->query->get('keyword');

        $qb = $this->dm->createQueryBuilder(ConcessionSku::class);

        if ($category) {
            $qb->field('category')->equals($category);
        }
        if ($status) {
            $qb->field('status')->equals($status);
        }
        if ($cinemaId) {
            $qb->field('cinemaId')->equals($cinemaId);
        }
        if ($keyword) {
            $qb->field('name')->equals(new \MongoDB\BSON\Regex($keyword, 'i'));
        }

        $qb->sort('category', 'asc')->sort('name', 'asc');
        $cursor = $qb->getQuery()->execute();

        $items = [];
        foreach ($cursor as $c) {
            $items[] = $this->serializeSku($c);
        }

        return $this->jsonSuccess(['items' => $items, 'total' => count($items)]);
    }

    #[Route('/api/concessions/low-stock', name: 'api_concession_low_stock', methods: ['GET'])]
    public function lowStock(Request $request): JsonResponse
    {
        $cinemaId = $request->query->get('cinemaId');

        $qb = $this->dm->createQueryBuilder(ConcessionSku::class)
            ->field('status')->in([ConcessionSku::STATUS_LOW_STOCK, ConcessionSku::STATUS_OUT_OF_STOCK]);

        if ($cinemaId) {
            $qb->field('cinemaId')->equals($cinemaId);
        }

        $cursor = $qb->getQuery()->execute();

        $items = [];
        foreach ($cursor as $c) {
            $items[] = array_merge($this->serializeSku($c), [
                'reorderQuantity' => $c->getReorderQuantity(),
                'suggestedAction' => $c->getStatus() === ConcessionSku::STATUS_OUT_OF_STOCK
                    ? '立即补货（已断货）'
                    : '近期补货（库存偏低）',
                'urgency' => $c->getStatus() === ConcessionSku::STATUS_OUT_OF_STOCK ? 'urgent' : 'warning',
            ]);
        }

        return $this->jsonSuccess([
            'items' => $items,
            'total' => count($items),
            'urgentCount' => count(array_filter($items, fn($i) => $i['urgency'] === 'urgent')),
        ]);
    }

    #[Route('/api/concessions/{id}/restock-alert', name: 'api_concession_restock_alert', methods: ['POST'])]
    public function triggerRestockAlert(string $id): JsonResponse
    {
        $sku = $this->dm->getRepository(ConcessionSku::class)->find($id);
        if (!$sku) {
            return $this->jsonError('商品不存在', 404, 'NOT_FOUND');
        }

        if (!$sku->needsRestock()) {
            return $this->jsonError('库存充足，无需补货', 400, 'STOCK_OK');
        }

        $notification = [
            'skuId' => $sku->getId(),
            'skuName' => $sku->getName(),
            'category' => $sku->getCategory(),
            'currentStock' => $sku->getStock(),
            'reorderLevel' => $sku->getReorderLevel(),
            'suggestedQuantity' => $sku->getReorderQuantity(),
            'urgency' => $sku->getStatus() === ConcessionSku::STATUS_OUT_OF_STOCK ? 'urgent' : 'warning',
            'cinemaId' => $sku->getCinemaId(),
            'alertTime' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
            'notificationChannels' => ['站内信', '飞书机器人', '短信'],
        ];

        return $this->jsonSuccess([
            'alert' => true,
            'notification' => $notification,
        ]);
    }

    #[Route('/api/concessions', name: 'api_concession_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);

        $required = ['name', 'category', 'price', 'cost', 'stock'];
        foreach ($required as $k) {
            if (!isset($body[$k])) {
                return $this->jsonError('缺少必要字段: ' . $k, 400, 'MISSING_FIELD');
            }
        }

        $sku = new ConcessionSku();
        $sku->setId($body['id'] ?? uniqid('ck_', true));
        $sku->setName($body['name']);
        $sku->setImage($body['image'] ?? null);
        $sku->setCategory($body['category']);
        $sku->setPrice((int)$body['price']);
        $sku->setCost((int)$body['cost']);
        $sku->setStock((int)$body['stock']);
        $sku->setReorderLevel((int)($body['reorderLevel'] ?? 20));
        $sku->setReorderQuantity((int)($body['reorderQuantity'] ?? 50));
        $sku->setCinemaId($body['cinemaId'] ?? null);
        $sku->setUnit($body['unit'] ?? '份');
        $sku->setActive(true);
        $sku->setTags($body['tags'] ?? []);
        $sku->refreshStatus();

        $this->dm->persist($sku);
        $this->dm->flush();

        return $this->jsonSuccess($this->serializeSku($sku), 201);
    }

    #[Route('/api/concessions/{id}', name: 'api_concession_update', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $sku = $this->dm->getRepository(ConcessionSku::class)->find($id);
        if (!$sku) {
            return $this->jsonError('商品不存在', 404, 'NOT_FOUND');
        }

        $body = $this->getJsonBody($request);

        if (isset($body['name'])) $sku->setName($body['name']);
        if (isset($body['image'])) $sku->setImage($body['image']);
        if (isset($body['category'])) $sku->setCategory($body['category']);
        if (isset($body['price'])) $sku->setPrice((int)$body['price']);
        if (isset($body['cost'])) $sku->setCost((int)$body['cost']);
        if (isset($body['stock'])) $sku->setStock((int)$body['stock']);
        if (isset($body['reorderLevel'])) $sku->setReorderLevel((int)$body['reorderLevel']);
        if (isset($body['reorderQuantity'])) $sku->setReorderQuantity((int)$body['reorderQuantity']);
        if (isset($body['cinemaId'])) $sku->setCinemaId($body['cinemaId']);
        if (isset($body['unit'])) $sku->setUnit($body['unit']);
        if (isset($body['active'])) $sku->setActive((bool)$body['active']);
        if (isset($body['tags'])) $sku->setTags($body['tags']);

        $sku->refreshStatus();
        $this->dm->flush();

        return $this->jsonSuccess($this->serializeSku($sku));
    }

    #[Route('/api/concessions/{id}/restock', name: 'api_concession_restock', methods: ['POST'])]
    public function restock(string $id, Request $request): JsonResponse
    {
        $sku = $this->dm->getRepository(ConcessionSku::class)->find($id);
        if (!$sku) {
            return $this->jsonError('商品不存在', 404, 'NOT_FOUND');
        }

        $body = $this->getJsonBody($request);
        $quantity = (int)($body['quantity'] ?? $sku->getReorderQuantity());

        if ($quantity <= 0) {
            return $this->jsonError('补货数量必须大于0', 400, 'INVALID_QUANTITY');
        }

        $oldStock = $sku->getStock();
        $sku->setStock($oldStock + $quantity);
        $sku->refreshStatus();
        $this->dm->flush();

        return $this->jsonSuccess([
            'id' => $sku->getId(),
            'name' => $sku->getName(),
            'oldStock' => $oldStock,
            'restocked' => $quantity,
            'newStock' => $sku->getStock(),
            'status' => $sku->getStatus(),
        ]);
    }

    #[Route('/api/concessions/{id}', name: 'api_concession_delete', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $sku = $this->dm->getRepository(ConcessionSku::class)->find($id);
        if (!$sku) {
            return $this->jsonError('商品不存在', 404, 'NOT_FOUND');
        }
        $this->dm->remove($sku);
        $this->dm->flush();
        return $this->jsonSuccess(['deleted' => true, 'id' => $id]);
    }

    private function serializeSku(ConcessionSku $c): array
    {
        return [
            'id' => $c->getId(),
            'name' => $c->getName(),
            'image' => $c->getImage(),
            'category' => $c->getCategory(),
            'price' => $c->getPrice(),
            'cost' => $c->getCost(),
            'stock' => $c->getStock(),
            'reorderLevel' => $c->getReorderLevel(),
            'status' => $c->getStatus(),
            'active' => $c->isActive(),
            'soldToday' => $c->getSoldToday(),
            'soldWeek' => $c->getSoldWeek(),
            'soldMonth' => $c->getSoldMonth(),
            'unit' => $c->getUnit(),
            'cinemaId' => $c->getCinemaId(),
            'tags' => $c->getTags(),
            'needsRestock' => $c->needsRestock(),
        ];
    }
}
