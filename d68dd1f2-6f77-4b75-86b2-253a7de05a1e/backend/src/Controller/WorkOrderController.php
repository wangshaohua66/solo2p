<?php

namespace App\Controller;

use App\Service\WorkOrderService;
use App\Service\PricingService;
use App\Service\ReportService;
use App\Service\ImageUploadService;
use Nelmio\ApiDocBundle\Annotation\Model;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Annotation\Route;
use OpenApi\Annotations as OA;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/work-orders')]
class WorkOrderController extends AbstractController
{
    public function __construct(
        private readonly WorkOrderService $workOrderService,
        private readonly PricingService $pricingService,
        private readonly ReportService $reportService,
        private readonly ImageUploadService $imageUploadService,
        private readonly SerializerInterface $serializer,
    ) {}

    #[Route('/list', methods: ['POST'])]
    public function list(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $result = $this->workOrderService->list(
            filters: $body['filter'] ?? [],
            page: (int)($body['page'] ?? 1),
            pageSize: (int)($body['pageSize'] ?? 20),
        );

        $json = $this->serializer->serialize($result, 'json', [
            'groups' => ['workorder:list'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);

        return new JsonResponse($json, 200, [], true);
    }

    #[Route('/{id}', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function get(int $id): JsonResponse
    {
        $order = $this->workOrderService->get($id);
        $json = $this->serializer->serialize($order, 'json', [
            'groups' => ['workorder:read'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);
        return new JsonResponse($json, 200, [], true);
    }

    #[Route('', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?: [];
        $order = $this->workOrderService->create($data);

        return new JsonResponse(
            json_decode($this->serializer->serialize($order, 'json', [
                'groups' => ['workorder:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true),
            201
        );
    }

    #[Route('/{id}', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?: [];
        $order = $this->workOrderService->update($id, $data);

        return new JsonResponse(
            json_decode($this->serializer->serialize($order, 'json', [
                'groups' => ['workorder:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true)
        );
    }

    #[Route('/{id}', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $this->workOrderService->changeStatus($id, \App\Entity\WorkOrder::STATUS_ARCHIVED, '系统删除操作');
        return $this->json(['success' => true]);
    }

    #[Route('/{id}/status', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function changeStatus(int $id, Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $order = $this->workOrderService->changeStatus(
            id: $id,
            newStatus: $body['status'],
            note: $body['note'] ?? null,
        );

        return new JsonResponse(
            json_decode($this->serializer->serialize($order, 'json', [
                'groups' => ['workorder:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true)
        );
    }

    #[Route('/check-repeat', methods: ['POST'])]
    public function checkRepeat(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $result = $this->workOrderService->checkRepeatVisit(
            caseSerial: $body['caseSerialNumber'] ?? '',
            customerName: $body['customerName'] ?? '',
        );
        return $this->json($result);
    }

    #[Route('/qr-token', methods: ['POST'])]
    public function generateQrToken(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $result = $this->workOrderService->generateQrToken($body['orderNumber'] ?? '');
        return $this->json($result);
    }

    #[Route('/{id}/calculate-quote', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function calculateQuote(int $id): JsonResponse
    {
        $order = $this->workOrderService->get($id);
        $quote = $this->pricingService->calculateQuote($order);
        return $this->json($quote);
    }

    #[Route('/{id}/inspection', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function saveInspection(int $id, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?: [];
        $inspection = $this->workOrderService->saveInspection($id, $data);
        return new JsonResponse(
            json_decode($this->serializer->serialize($inspection, 'json', [
                'groups' => ['workorder:read'],
                'circular_reference_handler' => fn($o) => $o->getId(),
            ]), true)
        );
    }

    #[Route('/{id}/parts', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function addPartUsage(int $id, Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $usage = $this->workOrderService->addPartUsage(
            orderId: $id,
            partId: (int)$body['partId'],
            quantity: (int)($body['quantity'] ?? 1),
            batchNumber: $body['batchNumber'] ?? null,
        );
        return new JsonResponse(
            json_decode($this->serializer->serialize($usage, 'json', [
                'groups' => ['workorder:read'],
            ]), true),
            201
        );
    }

    #[Route('/{id}/parts/{usageId}', methods: ['DELETE'], requirements: ['id' => '\d+', 'usageId' => '\d+'])]
    public function removePartUsage(int $id, int $usageId): JsonResponse
    {
        $this->workOrderService->removePartUsage($id, $usageId);
        return $this->json(['success' => true]);
    }

    #[Route('/{id}/images/{type}', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function uploadImage(int $id, string $type, Request $request): JsonResponse
    {
        $file = $request->files->get('file');
        if (!$file) {
            throw new \Symfony\Component\HttpKernel\Exception\BadRequestHttpException('缺少文件');
        }
        $result = $this->imageUploadService->uploadWorkOrderImage($id, $file, $type);
        return $this->json($result, 201);
    }

    #[Route('/{id}/images/{imageId}', methods: ['DELETE'], requirements: ['id' => '\d+', 'imageId' => '\d+'])]
    public function removeImage(int $id, int $imageId): JsonResponse
    {
        $this->imageUploadService->deleteImage($imageId);
        return $this->json(['success' => true]);
    }

    #[Route('/{id}/report', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function generateReport(int $id): JsonResponse
    {
        $order = $this->workOrderService->get($id);
        $report = $this->reportService->generateServiceReportData($order);
        return $this->json($report);
    }

    #[Route('/{id}/report/pdf', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function downloadReportPdf(int $id): BinaryFileResponse
    {
        $order = $this->workOrderService->get($id);
        $pdfPath = $this->reportService->generatePdf($order);

        $response = new BinaryFileResponse($pdfPath);
        $response->setContentDisposition(
            ResponseHeaderBag::DISPOSITION_ATTACHMENT,
            sprintf('%s-服务报告.pdf', $order->getOrderNumber())
        );
        $response->headers->set('Content-Type', 'application/pdf');
        return $response;
    }

    #[Route('/{id}/report/send-email', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function sendReportEmail(int $id, Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $order = $this->workOrderService->get($id);
        $result = $this->reportService->sendReportByEmail($order, $body['email'] ?? null);
        return $this->json(['success' => $result]);
    }
}
