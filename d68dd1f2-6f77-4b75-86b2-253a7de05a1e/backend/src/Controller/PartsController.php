<?php

namespace App\Controller;

use App\Service\PartsService;
use App\Service\PartsUsageService;
use App\Repository\PartsRepository;
use App\Repository\PartCategoryRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/parts')]
class PartsController extends AbstractController
{
    public function __construct(
        private readonly PartsService $partsService,
        private readonly PartsUsageService $usageService,
        private readonly PartsRepository $partsRepo,
        private readonly PartCategoryRepository $categoryRepo,
        private readonly SerializerInterface $serializer,
    ) {}

    #[Route('/list', methods: ['POST'])]
    public function list(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $result = $this->partsService->list(
            filters: $body['filter'] ?? [],
            page: (int)($body['page'] ?? 1),
            pageSize: (int)($body['pageSize'] ?? 50),
        );

        $json = $this->serializer->serialize($result, 'json', [
            'groups' => ['parts:list'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);

        return new JsonResponse($json, 200, [], true);
    }

    #[Route('/{id}', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function get(int $id): JsonResponse
    {
        $part = $this->partsRepo->find($id);
        if (!$part) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException('配件不存在');
        }
        $json = $this->serializer->serialize($part, 'json', [
            'groups' => ['parts:read'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return new JsonResponse($json, 200, [], true);
    }

    #[Route('', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?: [];
        $part = $this->partsService->create($data);
        return new JsonResponse(
            json_decode($this->serializer->serialize($part, 'json', [
                'groups' => ['parts:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true),
            201
        );
    }

    #[Route('/{id}', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?: [];
        $part = $this->partsService->update($id, $data);
        return new JsonResponse(
            json_decode($this->serializer->serialize($part, 'json', [
                'groups' => ['parts:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true)
        );
    }

    #[Route('/{id}', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $this->partsService->delete($id);
        return $this->json(['success' => true]);
    }

    #[Route('/barcode/{barcode}', methods: ['GET'])]
    public function findByBarcode(string $barcode): JsonResponse
    {
        $part = $this->partsRepo->findOneBy(['barcode' => $barcode]);
        if (!$part) {
            return $this->json(['found' => false, 'part' => null]);
        }
        return $this->json([
            'found' => true,
            'part' => json_decode($this->serializer->serialize($part, 'json', [
                'groups' => ['parts:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true),
        ]);
    }

    #[Route('/scan-out', methods: ['POST'])]
    public function scanOut(Request $request): JsonResponse
    {
        $start = microtime(true);
        $body = json_decode($request->getContent(), true) ?: [];

        $barcode = $body['barcode'] ?? '';
        $orderId = (int)($body['workOrderId'] ?? 0);
        $quantity = (int)($body['quantity'] ?? 1);
        $batchNumber = $body['batchNumber'] ?? null;

        if (empty($barcode) || $orderId <= 0) {
            throw new \Symfony\Component\HttpKernel\Exception\BadRequestHttpException('条码和工单号必填');
        }

        $result = $this->usageService->scanAndUse(
            barcode: $barcode,
            workOrderId: $orderId,
            quantity: $quantity,
            batchNumber: $batchNumber,
        );

        $elapsed = round((microtime(true) - $start) * 1000, 2);

        return new JsonResponse(array_merge($result, [
            'responseTimeMs' => $elapsed,
        ]));
    }

    #[Route('/{id}/stock', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function adjustStock(int $id, Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $delta = (int)($body['delta'] ?? 0);
        $reason = $body['reason'] ?? '手动调整';

        $part = $this->partsService->adjustStock($id, $delta, $reason);
        return new JsonResponse(
            json_decode($this->serializer->serialize($part, 'json', [
                'groups' => ['parts:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true)
        );
    }

    #[Route('/low-stock', methods: ['GET'])]
    public function lowStockList(): JsonResponse
    {
        $parts = $this->partsService->getLowStockParts();
        $json = $this->serializer->serialize($parts, 'json', [
            'groups' => ['parts:list'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return new JsonResponse($json, 200, [], true);
    }

    #[Route('/categories', methods: ['GET'])]
    public function categories(): JsonResponse
    {
        $categories = $this->categoryRepo->findBy([], ['sort' => 'ASC', 'id' => 'ASC']);
        $json = $this->serializer->serialize($categories, 'json', [
            'groups' => ['parts:list'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return new JsonResponse($json, 200, [], true);
    }

    #[Route('/usage-history', methods: ['POST'])]
    public function usageHistory(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $result = $this->usageService->history(
            filters: $body['filter'] ?? [],
            page: (int)($body['page'] ?? 1),
            pageSize: (int)($body['pageSize'] ?? 50),
        );
        $json = $this->serializer->serialize($result, 'json', [
            'groups' => ['workorder:read'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return new JsonResponse($json, 200, [], true);
    }
}
