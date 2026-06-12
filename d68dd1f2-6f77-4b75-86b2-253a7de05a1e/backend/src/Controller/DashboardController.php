<?php

namespace App\Controller;

use App\Service\DashboardStatsService;
use App\Service\WarrantyNotificationService;
use App\Service\PartsService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api')]
class DashboardController extends AbstractController
{
    public function __construct(
        private readonly DashboardStatsService $stats,
        private readonly WarrantyNotificationService $warrantyService,
        private readonly PartsService $partsService,
    ) {}

    #[Route('/dashboard/overview', methods: ['GET'])]
    public function overview(): JsonResponse
    {
        $data = $this->stats->overview();
        return $this->json($data);
    }

    #[Route('/dashboard/shelf-map', methods: ['GET'])]
    public function shelfMap(): JsonResponse
    {
        $map = $this->partsService->getShelfMap();
        return $this->json($map);
    }

    #[Route('/warranty/run-check', methods: ['POST'])]
    public function runWarrantyCheck(): JsonResponse
    {
        $result = $this->warrantyService->checkAndNotify();
        return $this->json($result);
    }

    #[Route('/warranty/expiring', methods: ['GET'])]
    public function expiring(Request $request): JsonResponse
    {
        $days = (int)($request->query->get('withinDays', 60));
        $result = $this->warrantyService->listExpiring($days);
        return $this->json($result);
    }

    #[Route('/warranty/{id}/notify', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function manualNotify(int $id, Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $success = $this->warrantyService->manualNotify($id, $body['channel'] ?? 'email');
        return $this->json(['success' => $success]);
    }

    #[Route('/warranty/batch-notify', methods: ['POST'])]
    public function batchNotify(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $ids = $body['ids'] ?? [];
        $channel = $body['channel'] ?? 'email';
        $success = 0;
        $failed = 0;
        foreach ($ids as $id) {
            try {
                if ($this->warrantyService->manualNotify((int)$id, $channel)) {
                    $success++;
                } else {
                    $failed++;
                }
            } catch (\Throwable) {
                $failed++;
            }
        }
        return $this->json([
            'total' => count($ids),
            'success' => $success,
            'failed' => $failed,
        ]);
    }
}
