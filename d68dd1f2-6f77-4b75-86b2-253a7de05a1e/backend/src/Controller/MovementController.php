<?php

namespace App\Controller;

use App\Service\MovementService;
use App\Service\WorkOrderService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/movements')]
class MovementController extends AbstractController
{
    public function __construct(
        private readonly MovementService $movementService,
        private readonly WorkOrderService $orderService,
        private readonly SerializerInterface $serializer,
    ) {}

    #[Route('/list', methods: ['POST'])]
    public function list(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $result = $this->movementService->list(
            filters: $body['filter'] ?? [],
            page: (int)($body['page'] ?? 1),
            pageSize: (int)($body['pageSize'] ?? 200),
        );

        $json = $this->serializer->serialize($result, 'json', [
            'groups' => ['movement:list'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return new JsonResponse($json, 200, [], true);
    }

    #[Route('/{id}', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function get(int $id): JsonResponse
    {
        $movement = $this->movementService->get($id);
        $json = $this->serializer->serialize($movement, 'json', [
            'groups' => ['movement:read'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return new JsonResponse($json, 200, [], true);
    }

    #[Route('/code/{code}', methods: ['GET'])]
    public function findByCode(string $code): JsonResponse
    {
        $movement = $this->movementService->findByCode($code);
        if (!$movement) {
            return $this->json(['found' => false, 'movement' => null]);
        }
        $json = $this->serializer->serialize($movement, 'json', [
            'groups' => ['movement:read'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return $this->json([
            'found' => true,
            'movement' => json_decode($json, true),
        ]);
    }

    #[Route('/brands', methods: ['GET'])]
    public function brands(): JsonResponse
    {
        return $this->json($this->movementService->brands());
    }

    #[Route('/seed', methods: ['POST'])]
    public function seed(): JsonResponse
    {
        $count = $this->movementService->seedIfEmpty();
        return $this->json([
            'created' => $count,
            'message' => $count > 0 ? "成功导入 $count 条机芯知识库记录" : '机芯库已有数据，跳过',
        ]);
    }

    #[Route('/{code}/reference-values', methods: ['GET'])]
    public function referenceValues(string $code): JsonResponse
    {
        $movement = $this->movementService->findByCode($code);
        if (!$movement) {
            return $this->json(['found' => false, 'standards' => null]);
        }

        return $this->json([
            'found' => true,
            'standards' => [
                'code' => $movement->getCode(),
                'brand' => $movement->getBrand(),
                'name' => $movement->getCommonName(),
                'frequency' => [
                    'value' => $movement->getStandardFrequency(),
                    'unit' => 'vph',
                    'label' => '标准振频',
                ],
                'amplitude' => [
                    'min' => $movement->getStandardAmplitudeMin(),
                    'max' => $movement->getStandardAmplitudeMax(),
                    'unit' => '°',
                    'label' => '振幅范围',
                ],
                'rate' => [
                    'min' => $movement->getStandardRateMin(),
                    'max' => $movement->getStandardRateMax(),
                    'unit' => 's/d',
                    'label' => '日差范围',
                ],
                'beatError' => [
                    'max' => $movement->getBeatErrorMax(),
                    'unit' => 'ms',
                    'label' => '最大位差',
                ],
                'powerReserve' => [
                    'min' => $movement->getStandardPowerReserveHours(),
                    'unit' => 'h',
                    'label' => '动力储备',
                ],
                'waterResistance' => $movement->getWaterResistanceRating(),
                'laborHours' => $movement->getStandardLaborHours(),
            ],
        ]);
    }
}
