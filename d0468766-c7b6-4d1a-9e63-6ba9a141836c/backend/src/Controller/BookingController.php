<?php

namespace App\Controller;

use App\Document\BookingOrder;
use App\Document\ScheduleItem;
use App\Document\Member;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class BookingController extends AbstractApiController
{
    public function __construct(private DocumentManager $dm)
    {
    }

    #[Route('/api/bookings', name: 'api_booking_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $scheduleId = $request->query->get('scheduleId');
        $memberId = $request->query->get('memberId');
        $status = $request->query->get('status');

        $qb = $this->dm->createQueryBuilder(BookingOrder::class);

        if ($scheduleId) {
            $qb->field('scheduleId')->equals($scheduleId);
        }
        if ($memberId) {
            $qb->field('memberId')->equals($memberId);
        }
        if ($status) {
            $qb->field('status')->equals($status);
        }

        $qb->sort('createdAt', 'desc');
        $cursor = $qb->getQuery()->execute();

        $orders = [];
        foreach ($cursor as $o) {
            $orders[] = $this->serializeOrder($o);
        }

        return $this->jsonSuccess(['items' => $orders, 'total' => count($orders)]);
    }

    #[Route('/api/bookings/{id}', name: 'api_booking_detail', methods: ['GET'])]
    public function detail(string $id): JsonResponse
    {
        $order = $this->dm->getRepository(BookingOrder::class)->find($id);
        if (!$order) {
            return $this->jsonError('订单不存在', 404, 'NOT_FOUND');
        }
        return $this->jsonSuccess($this->serializeOrder($order));
    }

    #[Route('/api/bookings', name: 'api_booking_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);

        $required = ['scheduleId', 'seats', 'totalAmount', 'ticketCount'];
        foreach ($required as $k) {
            if (!isset($body[$k])) {
                return $this->jsonError('缺少必要字段: ' . $k, 400, 'MISSING_FIELD');
            }
        }

        $schedule = $this->dm->getRepository(ScheduleItem::class)->find($body['scheduleId']);
        if (!$schedule) {
            return $this->jsonError('场次不存在', 404, 'SCHEDULE_NOT_FOUND');
        }

        $order = new BookingOrder();
        $order->setId($body['id'] ?? uniqid('ord_', true));
        $order->setOrderNo($body['orderNo'] ?? 'GY' . date('YmdHis') . mt_rand(1000, 9999));
        $order->setScheduleId($body['scheduleId']);
        $order->setMovieName($schedule->getMovieName());
        $order->setCinemaName($schedule->getCinemaName());
        $order->setHallName($schedule->getHallName());
        $order->setDate($schedule->getDate());
        $order->setStartTime($schedule->getStartTime());
        $order->setEndTime($schedule->getEndTime());
        $order->setSeats($body['seats']);
        $order->setTicketCount((int)$body['ticketCount']);
        $order->setTotalAmount((int)$body['totalAmount']);
        $order->setMemberId($body['memberId'] ?? null);
        $order->setMemberName($body['memberName'] ?? null);
        $order->setContactPhone($body['contactPhone'] ?? '');
        $order->setStatus($body['status'] ?? BookingOrder::STATUS_PENDING);
        $order->setConcessions($body['concessions'] ?? []);
        $order->setPayMethod($body['payMethod'] ?? '');

        if ($order->getMemberId()) {
            $points = (int)floor($body['totalAmount'] / 10);
            $order->setPointsEarned($points);
            $member = $this->dm->getRepository(Member::class)->find($order->getMemberId());
            if ($member) {
                $member->setPoints($member->getPoints() + $points);
                $this->dm->persist($member);
            }
        }

        $this->dm->persist($order);

        $schedule->setSeatsSold($schedule->getSeatsSold() + (int)$body['ticketCount']);
        $this->dm->flush();

        return $this->jsonSuccess($this->serializeOrder($order), 201);
    }

    #[Route('/api/bookings/{id}/pay', name: 'api_booking_pay', methods: ['POST'])]
    public function pay(string $id, Request $request): JsonResponse
    {
        $order = $this->dm->getRepository(BookingOrder::class)->find($id);
        if (!$order) {
            return $this->jsonError('订单不存在', 404, 'NOT_FOUND');
        }

        if ($order->getStatus() !== BookingOrder::STATUS_PENDING) {
            return $this->jsonError('订单状态不支持支付', 400, 'INVALID_STATUS');
        }

        $body = $this->getJsonBody($request);
        $order->setStatus(BookingOrder::STATUS_PAID);
        $order->setPaidAt(new \DateTimeImmutable());
        $order->setPayMethod($body['payMethod'] ?? 'wechat');
        $order->setQrCode($body['qrCode'] ?? 'GY_QR_' . $id);

        $this->dm->flush();

        return $this->jsonSuccess($this->serializeOrder($order));
    }

    #[Route('/api/bookings/{id}/cancel', name: 'api_booking_cancel', methods: ['POST'])]
    public function cancel(string $id): JsonResponse
    {
        $order = $this->dm->getRepository(BookingOrder::class)->find($id);
        if (!$order) {
            return $this->jsonError('订单不存在', 404, 'NOT_FOUND');
        }

        $order->setStatus(BookingOrder::STATUS_CANCELLED);
        $this->dm->flush();

        return $this->jsonSuccess($this->serializeOrder($order));
    }

    private function serializeOrder(BookingOrder $o): array
    {
        return [
            'id' => $o->getId(),
            'orderNo' => $o->getOrderNo(),
            'scheduleId' => $o->getScheduleId(),
            'movieName' => $o->getMovieName(),
            'cinemaName' => $o->getCinemaName(),
            'hallName' => $o->getHallName(),
            'date' => $o->getDate(),
            'startTime' => $o->getStartTime(),
            'endTime' => $o->getEndTime(),
            'seats' => $o->getSeats(),
            'ticketCount' => $o->getTicketCount(),
            'totalAmount' => $o->getTotalAmount(),
            'memberId' => $o->getMemberId(),
            'memberName' => $o->getMemberName(),
            'contactPhone' => $o->getContactPhone(),
            'status' => $o->getStatus(),
            'payMethod' => $o->getPayMethod(),
            'qrCode' => $o->getQrCode(),
            'concessions' => $o->getConcessions(),
            'pointsEarned' => $o->getPointsEarned(),
            'createdAt' => $o->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'paidAt' => $o->getPaidAt()?->format(\DateTimeInterface::ATOM),
        ];
    }
}
