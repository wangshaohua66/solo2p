<?php

namespace App\Controller;

use App\Document\Order;
use App\Document\Performance;
use App\Document\Seat;
use App\Document\SeatSection;
use App\Document\User;
use App\Document\Venue;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/tickets')]
class TicketController extends AbstractController
{
    private DocumentManager $dm;
    private SerializerInterface $serializer;

    public function __construct(
        DocumentManager $dm,
        SerializerInterface $serializer
    ) {
        $this->dm = $dm;
        $this->serializer = $serializer;
    }

    #[Route('/seats/{performanceId}', name: 'api_tickets_seats', methods: ['GET'])]
    public function getSeats(string $performanceId): JsonResponse
    {
        $performance = $this->dm->getRepository(Performance::class)->find($performanceId);
        if (!$performance) {
            return new JsonResponse(['message' => '演出不存在'], 404);
        }

        $qb = $this->dm->getRepository(Seat::class)->createQueryBuilder()
            ->field('performanceId')->equals($performanceId);
        $seats = $qb->getQuery()->toArray();

        if (empty($seats)) {
            $seats = $this->generateSeats($performance);
        }

        $earlyBirdActive = $performance->isEarlyBirdActive();
        $earlyBirdDeadline = $performance->getEarlyBirdDeadline();
        if ($earlyBirdDeadline === null && $performance->getStartTime() !== null) {
            $earlyBirdDeadline = (clone $performance->getStartTime())->modify('-14 days');
        }

        return new JsonResponse([
            'performance' => json_decode($this->serializer->serialize(
                $performance,
                'json',
                ['groups' => ['performance:read']]
            ), true),
            'seats' => json_decode($this->serializer->serialize(
                $seats,
                'json',
                ['groups' => ['seat:read']]
            ), true),
            'ticketAvailability' => [
                'earlyBirdActive' => $earlyBirdActive,
                'earlyBirdDeadline' => $earlyBirdDeadline?->format('Y-m-d H:i:s'),
                'regularActive' => true,
                'studentActive' => true,
                'groupActive' => true
            ]
        ]);
    }

    private function generateSeats(Performance $performance): array
    {
        $venue = $performance->getVenue();
        $seats = [];
        $performanceType = $performance->getType();

        foreach ($venue->getSeatConfig() as $section) {
            if (in_array($performanceType, $section->getDisabledForTypes())) {
                continue;
            }

            for ($row = 0; $row < $section->getRows(); $row++) {
                for ($col = 0; $col < $section->getColumns(); $col++) {
                    $actualRow = $section->getStartRow() + $row;
                    $actualCol = $section->getStartColumn() + $col;
                    $seatNumber = $this->generateSeatNumber($section, $actualRow, $actualCol);

                    $seat = new Seat();
                    $seat->setPerformanceId($performance->getId());
                    $seat->setSectionId($section->getId());
                    $seat->setRow($actualRow);
                    $seat->setColumn($actualCol);
                    $seat->setSeatNumber($seatNumber);
                    $seat->setStatus(Seat::STATUS_AVAILABLE);
                    $seat->setPrice($this->calculatePrice($section, $row, $section->getRows()));

                    $this->dm->persist($seat);
                    $seats[] = $seat;
                }
            }
        }

        $this->dm->flush();
        return $seats;
    }

    private function generateSeatNumber(SeatSection $section, int $row, int $col): string
    {
        switch ($section->getNumberingRule()) {
            case SeatSection::NUMBERING_CONTINUOUS:
                $offset = ($row - $section->getStartRow()) * $section->getColumns()
                    + ($col - $section->getStartColumn()) + 1;
                return $section->getName() . $offset;
            case SeatSection::NUMBERING_ROW_BASED:
                return $row . '排' . $col . '座';
            case SeatSection::NUMBERING_CUSTOM:
            default:
                return $section->getName() . ' ' . $row . '-' . $col;
        }
    }

    private function calculatePrice(SeatSection $section, int $rowIndex, int $totalRows): float
    {
        $basePrice = $section->getBasePrice();
        if ($totalRows <= 5) {
            return $basePrice;
        }

        $frontZone = (int)($totalRows * 0.3);
        $middleZone = (int)($totalRows * 0.6);

        if ($rowIndex < $frontZone) {
            return $basePrice * 1.2;
        } elseif ($rowIndex < $middleZone) {
            return $basePrice;
        } else {
            return $basePrice * 0.8;
        }
    }

    #[Route('/lock', name: 'api_tickets_lock', methods: ['POST'])]
    public function lockSeats(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $this->getUser();

        if (!$user) {
            return new JsonResponse(['message' => '请先登录'], 401);
        }

        $performanceId = $data['performanceId'];
        $seatIds = $data['seatIds'] ?? [];
        $ticketType = $data['ticketType'] ?? Seat::TICKET_REGULAR;
        $warnings = [];

        if (empty($seatIds)) {
            return new JsonResponse(['message' => '请选择座位'], 400);
        }

        $performance = $this->dm->getRepository(Performance::class)->find($performanceId);
        if (!$performance) {
            return new JsonResponse(['message' => '演出不存在'], 404);
        }

        if ($ticketType === Seat::TICKET_EARLY_BIRD && !$performance->isEarlyBirdActive()) {
            $ticketType = Seat::TICKET_REGULAR;
            $warnings[] = '早鸟票已截止，已自动切换为普通票';
        }

        if ($ticketType === Seat::TICKET_GROUP && count($seatIds) < 10) {
            return new JsonResponse(['message' => '团体票至少需要10张'], 400);
        }

        $this->dm->flush();

        $qb = $this->dm->getRepository(Seat::class)->createQueryBuilder()
            ->field('id')->in($seatIds)
            ->field('performanceId')->equals($performanceId)
            ->field('status')->equals(Seat::STATUS_AVAILABLE);

        $availableSeats = $qb->getQuery()->toArray();

        if (count($availableSeats) !== count($seatIds)) {
            return new JsonResponse([
                'message' => '部分座位已被锁定或售出',
                'availableCount' => count($availableSeats)
            ], 409);
        }

        $lockTime = new \DateTime();
        foreach ($availableSeats as $seat) {
            $seat->setStatus(Seat::STATUS_LOCKED);
            $seat->setLockedAt($lockTime);
            $seat->setLockedBy($user->getId());
            $seat->setTicketType($ticketType);
        }

        $this->dm->flush();

        $response = [
            'message' => '座位锁定成功',
            'ticketType' => $ticketType,
            'locks' => array_map(fn($seat) => [
                'seatId' => $seat->getId(),
                'lockedAt' => $seat->getLockedAt()?->format('Y-m-d H:i:s'),
                'expiresAt' => (clone $seat->getLockedAt())->modify('+15 minutes')->format('Y-m-d H:i:s')
            ], $availableSeats)
        ];
        if (!empty($warnings)) {
            $response['warnings'] = $warnings;
        }

        return new JsonResponse($response);
    }

    #[Route('/release', name: 'api_tickets_release', methods: ['POST'])]
    public function releaseSeats(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $lockIds = $data['lockIds'] ?? [];

        if (empty($lockIds)) {
            return new JsonResponse(['message' => '请指定要释放的座位'], 400);
        }

        $qb = $this->dm->getRepository(Seat::class)->createQueryBuilder()
            ->field('id')->in($lockIds)
            ->field('status')->equals(Seat::STATUS_LOCKED);

        $seats = $qb->getQuery()->toArray();

        foreach ($seats as $seat) {
            $seat->setStatus(Seat::STATUS_AVAILABLE);
            $seat->setLockedAt(null);
            $seat->setLockedBy(null);
            $seat->setTicketType(null);
        }

        $this->dm->flush();

        return new JsonResponse([
            'message' => '座位已释放',
            'releasedCount' => count($seats)
        ]);
    }

    #[Route('/order', name: 'api_tickets_create_order', methods: ['POST'])]
    public function createOrder(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $this->getUser();

        if (!$user) {
            return new JsonResponse(['message' => '请先登录'], 401);
        }

        $performanceId = $data['performanceId'];
        $seatIds = $data['seatIds'] ?? [];
        $ticketType = $data['ticketType'] ?? Seat::TICKET_REGULAR;
        $salesChannel = $data['salesChannel'] ?? Order::CHANNEL_WEBSITE;
        $warnings = [];

        if (empty($seatIds)) {
            return new JsonResponse(['message' => '请选择座位'], 400);
        }

        $performance = $this->dm->getRepository(Performance::class)->find($performanceId);
        if (!$performance || $performance->getStatus() !== Performance::STATUS_APPROVED) {
            return new JsonResponse(['message' => '该演出不可售票'], 400);
        }

        if ($ticketType === Seat::TICKET_EARLY_BIRD && !$performance->isEarlyBirdActive()) {
            $ticketType = Seat::TICKET_REGULAR;
            $warnings[] = '早鸟票已截止，已自动切换为普通票';
        }

        if ($ticketType === Seat::TICKET_GROUP && count($seatIds) < 10) {
            return new JsonResponse(['message' => '团体票至少需要10张'], 400);
        }

        $qb = $this->dm->getRepository(Seat::class)->createQueryBuilder()
            ->field('id')->in($seatIds)
            ->field('performanceId')->equals($performanceId)
            ->field('status')->equals(Seat::STATUS_LOCKED)
            ->field('lockedBy')->equals($user->getId());

        $lockedSeats = $qb->getQuery()->toArray();

        if (count($lockedSeats) !== count($seatIds)) {
            return new JsonResponse(['message' => '座位锁定已过期或被他人占用，请重新选座'], 409);
        }

        $order = new Order();
        $order->setPerformanceId($performanceId);
        $order->setPerformanceName($performance->getName());
        $order->setUserId($user->getId());
        $order->setUserName($user->getName());
        $order->setTicketType($ticketType);
        $order->setSalesChannel($salesChannel);
        $order->setStatus(Order::STATUS_PENDING);

        $originalTotal = 0;
        $totalAmount = 0;
        foreach ($lockedSeats as $seat) {
            $basePrice = $seat->getPrice();
            $originalTotal += $basePrice;
            $price = $this->applyTicketDiscount($basePrice, $ticketType, count($seatIds));
            $totalAmount += $price;
            $seat->setPrice($price);
            $seat->setTicketType($ticketType);
            $order->addSeat($seat);
        }

        $order->setTotalAmount($originalTotal);
        $order->setDiscountAmount(max(0, $originalTotal - $totalAmount));
        $order->setPayAmount($totalAmount);

        $this->dm->persist($order);

        foreach ($lockedSeats as $seat) {
            $seat->setOrderId($order->getId());
        }

        $this->dm->flush();

        $response = [
            'message' => '订单创建成功',
            'order' => json_decode($this->serializer->serialize(
                $order,
                'json',
                ['groups' => ['order:read']]
            ), true)
        ];
        if (!empty($warnings)) {
            $response['warnings'] = $warnings;
        }

        return new JsonResponse($response, 201);
    }

    private function applyTicketDiscount(float $price, string $ticketType, int $quantity): float
    {
        switch ($ticketType) {
            case Seat::TICKET_EARLY_BIRD:
                return round($price * 0.85, 2);
            case Seat::TICKET_STUDENT:
                return round($price * 0.5, 2);
            case Seat::TICKET_GROUP:
                return $quantity >= 10 ? round($price * 0.8, 2) : $price;
            case Seat::TICKET_REGULAR:
            default:
                return $price;
        }
    }

    #[Route('/pay', name: 'api_tickets_pay', methods: ['POST'])]
    public function payOrder(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $this->getUser();

        $orderId = $data['orderId'];
        $paymentChannel = $data['paymentChannel'] ?? Order::PAYMENT_WECHAT;

        $order = $this->dm->getRepository(Order::class)->find($orderId);
        if (!$order) {
            return new JsonResponse(['message' => '订单不存在'], 404);
        }

        if ($order->getUserId() !== $user->getId()) {
            return new JsonResponse(['message' => '无权操作此订单'], 403);
        }

        if ($order->getStatus() !== Order::STATUS_PENDING) {
            return new JsonResponse(['message' => '订单状态不允许支付'], 400);
        }

        $createdAt = $order->getCreatedAt();
        $expireTime = (clone $createdAt)->modify('+10 minutes');
        if (new \DateTime() > $expireTime) {
            $order->setStatus(Order::STATUS_CANCELLED);
            $order->setCancelledAt(new \DateTime());

            foreach ($order->getSeats() as $seat) {
                $seat->setStatus(Seat::STATUS_AVAILABLE);
                $seat->setLockedAt(null);
                $seat->setLockedBy(null);
                $seat->setOrderId(null);
                $seat->setTicketType(null);
            }

            $this->dm->flush();
            return new JsonResponse(['message' => '订单已超时取消'], 400);
        }

        $order->setStatus(Order::STATUS_PAID);
        $order->setPaidAt(new \DateTime());
        $order->setPaymentChannel($paymentChannel);
        $order->setQrCode($order->getOrderNo() . '_' . time());

        foreach ($order->getSeats() as $seat) {
            $seat->setStatus(Seat::STATUS_SOLD);
            $seat->setLockedAt(null);
            $seat->setLockedBy(null);
        }

        $this->dm->flush();

        return new JsonResponse([
            'message' => '支付成功',
            'order' => json_decode($this->serializer->serialize(
                $order,
                'json',
                ['groups' => ['order:read']]
            ), true)
        ]);
    }

    #[Route('/refund/{orderId}', name: 'api_tickets_refund', methods: ['POST'])]
    public function refundOrder(string $orderId): JsonResponse
    {
        $user = $this->getUser();

        $order = $this->dm->getRepository(Order::class)->find($orderId);
        if (!$order) {
            return new JsonResponse(['message' => '订单不存在'], 404);
        }

        if ($order->getUserId() !== $user->getId()) {
            return new JsonResponse(['message' => '无权操作此订单'], 403);
        }

        if ($order->getStatus() !== Order::STATUS_PAID) {
            return new JsonResponse(['message' => '订单状态不允许退票'], 400);
        }

        $performance = $this->dm->getRepository(Performance::class)->find($order->getPerformanceId());
        if (!$performance || !$performance->getStartTime()) {
            return new JsonResponse(['message' => '演出信息异常'], 400);
        }

        $startTime = $performance->getStartTime();
        $now = new \DateTime();
        $daysDiff = ($startTime->getTimestamp() - $now->getTimestamp()) / 86400;

        if ($daysDiff < 3) {
            return new JsonResponse(['message' => '距演出不足3天，不可退票'], 400);
        }

        $refundFee = 0;
        if ($daysDiff < 7) {
            $refundFee = round($order->getPayAmount() * 0.2, 2);
        }

        $refundAmount = $order->getPayAmount() - $refundFee;

        $order->setStatus(Order::STATUS_REFUNDED);
        $order->setRefundAmount($refundAmount);
        $order->setRefundFee($refundFee);

        foreach ($order->getSeats() as $seat) {
            $seat->setStatus(Seat::STATUS_AVAILABLE);
            $seat->setOrderId(null);
            $seat->setTicketType(null);
        }

        $this->dm->flush();

        return new JsonResponse([
            'message' => '退票成功',
            'refundAmount' => $refundAmount,
            'refundFee' => $refundFee,
            'order' => json_decode($this->serializer->serialize(
                $order,
                'json',
                ['groups' => ['order:read']]
            ), true)
        ]);
    }

    #[Route('/orders', name: 'api_tickets_orders', methods: ['GET'])]
    public function myOrders(Request $request): JsonResponse
    {
        $user = $this->getUser();

        $qb = $this->dm->getRepository(Order::class)->createQueryBuilder()
            ->field('userId')->equals($user->getId())
            ->sort('createdAt', 'desc');

        $status = $request->query->get('status');
        if ($status) {
            $qb->field('status')->equals($status);
        }

        $orders = $qb->getQuery()->toArray();

        return new JsonResponse([
            'orders' => json_decode($this->serializer->serialize(
                $orders,
                'json',
                ['groups' => ['order:list']]
            ), true),
            'total' => count($orders)
        ]);
    }

    #[Route('/orders/{orderId}', name: 'api_tickets_order_detail', methods: ['GET'])]
    public function orderDetail(string $orderId): JsonResponse
    {
        $user = $this->getUser();

        $order = $this->dm->getRepository(Order::class)->find($orderId);
        if (!$order) {
            return new JsonResponse(['message' => '订单不存在'], 404);
        }

        if ($order->getUserId() !== $user->getId() &&
            !in_array($user->getRole(), [User::ROLE_VENUE_ADMIN, User::ROLE_FINANCE])) {
            return new JsonResponse(['message' => '无权查看此订单'], 403);
        }

        return new JsonResponse([
            'order' => json_decode($this->serializer->serialize(
                $order,
                'json',
                ['groups' => ['order:read']]
            ), true)
        ]);
    }

    #[Route('/verify', name: 'api_tickets_verify', methods: ['POST'])]
    public function verifyTicket(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $this->getUser();

        if (!$user) {
            return new JsonResponse(['message' => '请先登录'], 401);
        }
        if (!in_array($user->getRole(), [User::ROLE_VENUE_ADMIN, User::ROLE_FINANCE])) {
            return new JsonResponse(['message' => '无权操作核销'], 403);
        }

        $qrCode = $data['qrCode'] ?? '';
        $orderNo = $data['orderNo'] ?? '';

        if (empty($qrCode) && empty($orderNo)) {
            return new JsonResponse(['message' => '请提供核销码或订单号'], 400);
        }

        $qb = $this->dm->getRepository(Order::class)->createQueryBuilder();
        if (!empty($qrCode)) {
            $qb->field('qrCode')->equals($qrCode);
        } else {
            $qb->field('orderNo')->equals($orderNo);
        }

        $order = $qb->getQuery()->getSingleResult();
        if (!$order) {
            return new JsonResponse(['message' => '订单不存在'], 404);
        }

        if ($order->getStatus() === Order::STATUS_USED) {
            return new JsonResponse([
                'message' => '该订单已核销',
                'usedAt' => $order->getUsedAt()?->format('Y-m-d H:i:s'),
                'order' => json_decode($this->serializer->serialize($order, 'json', ['groups' => ['order:read']]), true)
            ], 409);
        }

        if ($order->getStatus() !== Order::STATUS_PAID) {
            return new JsonResponse([
                'message' => '订单状态异常，当前状态：' . $order->getStatus(),
                'orderStatus' => $order->getStatus()
            ], 400);
        }

        $now = new \DateTime();
        $performance = $this->dm->getRepository(Performance::class)->find($order->getPerformanceId());
        if ($performance && $performance->getStartTime()) {
            $startTime = $performance->getStartTime();
            $diffHours = ($startTime->getTimestamp() - $now->getTimestamp()) / 3600;
            if ($diffHours > 4) {
                return new JsonResponse([
                    'message' => '距离演出开始超过4小时，暂不可核销',
                    'startTime' => $startTime->format('Y-m-d H:i:s')
                ], 400);
            }
        }

        $order->setStatus(Order::STATUS_USED);
        $order->setUsedAt($now);
        $order->setVerifiedBy($user->getId());
        $order->setVerifiedByName($user->getName());

        $this->dm->flush();

        return new JsonResponse([
            'message' => '核销成功',
            'verifiedAt' => $now->format('Y-m-d H:i:s'),
            'verifiedBy' => $user->getName(),
            'seatCount' => $order->getSeats()->count(),
            'order' => json_decode($this->serializer->serialize($order, 'json', ['groups' => ['order:read']]), true)
        ]);
    }

    #[Route('/verify/batch', name: 'api_tickets_verify_batch', methods: ['POST'])]
    public function verifyBatch(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $user = $this->getUser();

        if (!$user) {
            return new JsonResponse(['message' => '请先登录'], 401);
        }
        if (!in_array($user->getRole(), [User::ROLE_VENUE_ADMIN, User::ROLE_FINANCE])) {
            return new JsonResponse(['message' => '无权操作核销'], 403);
        }

        $items = $data['items'] ?? [];
        if (empty($items)) {
            return new JsonResponse(['message' => '请提供核销列表'], 400);
        }

        $now = new \DateTime();
        $results = ['success' => 0, 'failed' => 0, 'skipped' => 0, 'details' => []];

        foreach ($items as $idx => $item) {
            $qrCode = $item['qrCode'] ?? '';
            $orderNo = $item['orderNo'] ?? '';

            try {
                $qb = $this->dm->getRepository(Order::class)->createQueryBuilder();
                if (!empty($qrCode)) {
                    $qb->field('qrCode')->equals($qrCode);
                } elseif (!empty($orderNo)) {
                    $qb->field('orderNo')->equals($orderNo);
                } else {
                    $results['failed']++;
                    $results['details'][] = ['index' => $idx, 'status' => 'failed', 'reason' => '缺少核销标识'];
                    continue;
                }

                $order = $qb->getQuery()->getSingleResult();
                if (!$order) {
                    $results['failed']++;
                    $results['details'][] = ['index' => $idx, 'status' => 'failed', 'reason' => '订单不存在'];
                    continue;
                }

                if ($order->getStatus() === Order::STATUS_USED) {
                    $results['skipped']++;
                    $results['details'][] = ['index' => $idx, 'orderNo' => $order->getOrderNo(), 'status' => 'skipped', 'reason' => '已核销'];
                    continue;
                }

                if ($order->getStatus() !== Order::STATUS_PAID) {
                    $results['failed']++;
                    $results['details'][] = ['index' => $idx, 'orderNo' => $order->getOrderNo(), 'status' => 'failed', 'reason' => '状态异常: ' . $order->getStatus()];
                    continue;
                }

                $order->setStatus(Order::STATUS_USED);
                $order->setUsedAt($now);
                $order->setVerifiedBy($user->getId());
                $order->setVerifiedByName($user->getName());

                $results['success']++;
                $results['details'][] = [
                    'index' => $idx,
                    'orderNo' => $order->getOrderNo(),
                    'status' => 'success',
                    'seats' => $order->getSeats()->count(),
                    'customer' => $order->getUserName()
                ];
            } catch (\Exception $e) {
                $results['failed']++;
                $results['details'][] = ['index' => $idx, 'status' => 'failed', 'reason' => $e->getMessage()];
            }
        }

        $this->dm->flush();

        return new JsonResponse([
            'message' => '批量核销完成',
            'total' => count($items),
            'success' => $results['success'],
            'failed' => $results['failed'],
            'skipped' => $results['skipped'],
            'verifiedAt' => $now->format('Y-m-d H:i:s'),
            'verifiedBy' => $user->getName(),
            'details' => $results['details']
        ]);
    }
}
