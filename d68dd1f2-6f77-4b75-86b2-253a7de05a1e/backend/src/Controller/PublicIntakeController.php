<?php

namespace App\Controller;

use App\Service\WorkOrderService;
use App\Service\PricingService;
use App\Service\ImageUploadService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Cache\CacheItemPoolInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;

#[Route('/api/public')]
class PublicIntakeController extends AbstractController
{
    public function __construct(
        private readonly WorkOrderService $workOrderService,
        private readonly PricingService $pricingService,
        private readonly ImageUploadService $imageService,
        private readonly EntityManagerInterface $em,
        private readonly CacheItemPoolInterface $cache,
        private readonly SerializerInterface $serializer,
    ) {}

    #[Route('/intake/{token}', methods: ['GET'])]
    public function getIntakeInfo(string $token): JsonResponse
    {
        $data = $this->resolveToken($token);
        if (!$data) {
            return $this->json([
                'mode' => 'new',
                'valid' => false,
                'message' => '无效或已过期的二维码，可继续使用自助登记',
            ]);
        }

        $order = $this->workOrderService->get($data['orderId']);

        $json = $this->serializer->serialize($order, 'json', [
            'groups' => ['public:read'],
            'circular_reference_handler' => fn($o) => $o->getId(),
        ]);

        $statusLabels = [
            \App\Entity\WorkOrder::STATUS_DRAFT => '登记中',
            \App\Entity\WorkOrder::STATUS_PENDING_QUOTE => '待报价',
            \App\Entity\WorkOrder::STATUS_QUOTED => '已报价',
            \App\Entity\WorkOrder::STATUS_IN_REPAIR => '维修中',
            \App\Entity\WorkOrder::STATUS_PENDING_QA => '质量检测中',
            \App\Entity\WorkOrder::STATUS_READY_FOR_PICKUP => '待取件',
            \App\Entity\WorkOrder::STATUS_DELIVERED => '已交付',
            \App\Entity\WorkOrder::STATUS_WARRANTY => '质保服务中',
            \App\Entity\WorkOrder::STATUS_ARCHIVED => '已归档',
        ];

        $statusDescriptions = [
            \App\Entity\WorkOrder::STATUS_DRAFT => '您的腕表信息已登记，等待工程师初步检测',
            \App\Entity\WorkOrder::STATUS_PENDING_QUOTE => '工程师正在检测您的腕表，稍后给出详细报价',
            \App\Entity\WorkOrder::STATUS_QUOTED => '报价已生成，我们会尽快与您联系确认',
            \App\Entity\WorkOrder::STATUS_IN_REPAIR => '您的腕表正在接受专业保养与维修',
            \App\Entity\WorkOrder::STATUS_PENDING_QA => '维修已完成，正在进行质量检测与走时观察',
            \App\Entity\WorkOrder::STATUS_READY_FOR_PICKUP => '您的腕表已准备好，欢迎随时前来取件',
            \App\Entity\WorkOrder::STATUS_DELIVERED => '您的腕表已交付，感谢您的信任！',
            \App\Entity\WorkOrder::STATUS_WARRANTY => '质保服务进行中，如有任何问题随时联系我们',
            \App\Entity\WorkOrder::STATUS_ARCHIVED => '工单已完成归档',
        ];

        $pickupCode = strtoupper(substr(md5($order->getOrderNumber() . ($order->getCustomer()?->getPhone() ?? '')), 0, 6));

        $timeline = [];
        foreach (array_slice(
            [
                \App\Entity\WorkOrder::STATUS_DRAFT => ['label' => '信息登记', 'done' => true],
                \App\Entity\WorkOrder::STATUS_PENDING_QUOTE => ['label' => '检测报价', 'done' => false],
                \App\Entity\WorkOrder::STATUS_QUOTED => ['label' => '确认报价', 'done' => false],
                \App\Entity\WorkOrder::STATUS_IN_REPAIR => ['label' => '机芯保养', 'done' => false],
                \App\Entity\WorkOrder::STATUS_PENDING_QA => ['label' => '质检观察', 'done' => false],
                \App\Entity\WorkOrder::STATUS_READY_FOR_PICKUP => ['label' => '待取件', 'done' => false],
                \App\Entity\WorkOrder::STATUS_DELIVERED => ['label' => '已交付', 'done' => false],
            ],
            0,
            7
        ) as $status => $info) {
            $timeline[] = [
                'status' => $status,
                'label' => $info['label'],
                'done' => $info['done'],
            ];
        }

        return $this->json([
            'mode' => 'existing',
            'valid' => true,
            'order' => json_decode($json, true),
            'statusLabel' => $statusLabels[$order->getStatus()] ?? $order->getStatus(),
            'statusDescription' => $statusDescriptions[$order->getStatus()] ?? '',
            'pickupCode' => $order->getStatus() === \App\Entity\WorkOrder::STATUS_READY_FOR_PICKUP ? $pickupCode : null,
            'estimatedDate' => $order->getEstimatedDeliveryDate()?->format('Y-m-d'),
            'priceInfo' => [
                'total' => (float)$order->getTotalPrice(),
                'deposit' => (float)$order->getDeposit(),
                'balance' => (float)$order->getTotalPrice() - (float)$order->getDeposit(),
                'isQuoted' => in_array(
                    $order->getStatus(),
                    [
                        \App\Entity\WorkOrder::STATUS_QUOTED,
                        \App\Entity\WorkOrder::STATUS_IN_REPAIR,
                        \App\Entity\WorkOrder::STATUS_PENDING_QA,
                        \App\Entity\WorkOrder::STATUS_READY_FOR_PICKUP,
                        \App\Entity\WorkOrder::STATUS_DELIVERED,
                    ],
                    true
                ),
            ],
            'timeline' => $timeline,
        ]);
    }

    #[Route('/intake/{token}/confirm-return', methods: ['POST'])]
    public function confirmTakeDelivery(string $token, Request $request): JsonResponse
    {
        $data = $this->resolveToken($token);
        if (!$data) {
            throw new \Symfony\Component\HttpKernel\Exception\BadRequestHttpException('无效二维码');
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $code = $body['pickupCode'] ?? '';
        $signature = $body['signature'] ?? null;

        $order = $this->workOrderService->get($data['orderId']);
        $expected = strtoupper(substr(md5($order->getOrderNumber() . ($order->getCustomer()?->getPhone() ?? '')), 0, 6));

        if (strtoupper($code) !== $expected) {
            return $this->json(['success' => false, 'error' => '取件码不匹配'], 400);
        }

        $this->workOrderService->changeStatus(
            id: $data['orderId'],
            newStatus: \App\Entity\WorkOrder::STATUS_DELIVERED,
            note: '客户扫码确认取件' . ($signature ? '，已签署电子签名' : ''),
        );

        return $this->json([
            'success' => true,
            'message' => '取件确认成功，感谢您的信任！',
            'warrantyInfo' => [
                'months' => $order->getWarrantyMonths(),
                'startDate' => (new \DateTimeImmutable())->format('Y-m-d'),
            ],
        ]);
    }

    #[Route('/intake/submit', methods: ['POST'])]
    public function submitNewIntake(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?: [];

        $order = $this->workOrderService->create($data);

        $token = bin2hex(random_bytes(16));
        $cacheKey = 'qr_token_' . $token;
        $cacheItem = $this->cache->getItem($cacheKey);
        $cacheItem->set(['orderId' => $order->getId(), 'orderNumber' => $order->getOrderNumber()]);
        $cacheItem->expiresAfter(86400 * 60);
        $this->cache->save($cacheItem);

        $qrCode = new QrCode(
            $this->generatePublicUrl($token)
        );
        $qrCode->setSize(240);
        $qrCode->setMargin(8);

        $writer = new PngWriter();
        $result = $writer->write($qrCode);
        $qrDataUri = 'data:image/png;base64,' . base64_encode($result->getString());

        return new JsonResponse([
            'success' => true,
            'orderId' => $order->getId(),
            'orderNumber' => $order->getOrderNumber(),
            'token' => $token,
            'status' => $order->getStatus(),
            'qrCode' => $qrDataUri,
            'publicUrl' => $this->generatePublicUrl($token),
            'pickupCode' => strtoupper(substr(md5($order->getOrderNumber() . ($order->getCustomer()?->getPhone() ?? '')), 0, 6)),
            'estimatedDate' => $order->getEstimatedDeliveryDate()?->format('Y-m-d')
                ?? (new \DateTimeImmutable('+7 days'))->format('Y-m-d'),
        ], 201);
    }

    #[Route('/lookup', methods: ['POST'])]
    public function lookupByCode(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $orderNumber = trim($body['orderNumber'] ?? '');
        $phone = trim($body['phone'] ?? '');

        if (empty($orderNumber) || empty($phone)) {
            throw new \Symfony\Component\HttpKernel\Exception\BadRequestHttpException('工单号和手机号必填');
        }

        $order = $this->em->getRepository(\App\Entity\WorkOrder::class)
            ->createQueryBuilder('wo')
            ->join('wo.customer', 'c')
            ->addSelect('c')
            ->where('wo.orderNumber = :num')
            ->andWhere('c.phone LIKE :phone')
            ->setParameter('num', $orderNumber)
            ->setParameter('phone', '%' . $phone . '%')
            ->getQuery()
            ->getOneOrNullResult();

        if (!$order) {
            return $this->json(['found' => false, 'message' => '未找到匹配的工单，请确认工单号和手机号']);
        }

        $token = bin2hex(random_bytes(16));
        $cacheKey = 'qr_token_' . $token;
        $cacheItem = $this->cache->getItem($cacheKey);
        $cacheItem->set(['orderId' => $order->getId(), 'orderNumber' => $order->getOrderNumber()]);
        $cacheItem->expiresAfter(86400 * 3);
        $this->cache->save($cacheItem);

        return $this->json([
            'found' => true,
            'token' => $token,
            'redirectUrl' => '/public/intake/' . $token,
        ]);
    }

    private function resolveToken(string $token): ?array
    {
        if (!$token) {
            return null;
        }
        $cacheKey = 'qr_token_' . $token;
        $cacheItem = $this->cache->getItem($cacheKey);
        if (!$cacheItem->isHit()) {
            return null;
        }
        $data = $cacheItem->get();
        if (!isset($data['orderId'])) {
            return null;
        }
        return $data;
    }

    private function generatePublicUrl(string $token): string
    {
        return 'https://watchstudio.example.com/public/intake/' . $token;
    }
}
