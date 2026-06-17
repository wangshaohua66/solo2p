<?php

namespace App\Controller;

use App\Document\Order;
use App\Document\Performance;
use App\Document\Settlement;
use App\Document\SettlementOrder;
use App\Document\User;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/settlements')]
class SettlementController extends AbstractController
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

    #[Route('', name: 'api_settlements_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $user = $this->getUser();
        $month = $request->query->get('month');
        $status = $request->query->get('status');

        $qb = $this->dm->getRepository(Settlement::class)->createQueryBuilder();

        if ($month) {
            $qb->field('month')->equals($month);
        }
        if ($status) {
            $qb->field('status')->equals($status);
        }

        if ($user->getRole() === User::ROLE_ORGANIZER) {
            $qb->field('organizerId')->equals($user->getId());
        }

        $qb->sort('createdAt', 'desc');
        $settlements = $qb->getQuery()->toArray();

        return new JsonResponse([
            'settlements' => json_decode($this->serializer->serialize(
                $settlements,
                'json',
                ['groups' => ['settlement:list']]
            ), true),
            'total' => count($settlements)
        ]);
    }

    #[Route('/{id}', name: 'api_settlements_show', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $user = $this->getUser();

        $settlement = $this->dm->getRepository(Settlement::class)->find($id);
        if (!$settlement) {
            return new JsonResponse(['message' => '结算单不存在'], 404);
        }

        if ($user->getRole() === User::ROLE_ORGANIZER && $settlement->getOrganizerId() !== $user->getId()) {
            return new JsonResponse(['message' => '无权查看此结算单'], 403);
        }

        return new JsonResponse([
            'settlement' => json_decode($this->serializer->serialize(
                $settlement,
                'json',
                ['groups' => ['settlement:read']]
            ), true)
        ]);
    }

    #[Route('/generate', name: 'api_settlements_generate', methods: ['POST'])]
    public function generate(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!in_array($user->getRole(), [User::ROLE_VENUE_ADMIN, User::ROLE_FINANCE])) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $data = json_decode($request->getContent(), true);
        $month = $data['month'] ?? date('Y-m', strtotime('-1 month'));

        $startDate = new \DateTime($month . '-01 00:00:00');
        $endDate = (clone $startDate)->modify('last day of this month 23:59:59');

        $perfQb = $this->dm->getRepository(Performance::class)->createQueryBuilder()
            ->field('status')->equals(Performance::STATUS_APPROVED)
            ->field('startTime')->gte($startDate)
            ->field('startTime')->lte($endDate);

        $performances = $perfQb->getQuery()->toArray();

        $settlements = [];

        foreach ($performances as $performance) {
            $existing = $this->dm->getRepository(Settlement::class)->findOneBy([
                'month' => $month,
                'performanceId' => $performance->getId()
            ]);

            if ($existing) {
                $settlements[] = $existing;
                continue;
            }

            $settlement = $this->generateSingleSettlement(
                $month,
                $performance,
                $startDate,
                $endDate
            );

            $settlements[] = $settlement;
        }

        return new JsonResponse([
            'message' => '月度结算单已生成',
            'settlements' => json_decode($this->serializer->serialize(
                $settlements,
                'json',
                ['groups' => ['settlement:list']]
            ), true),
            'count' => count($settlements)
        ]);
    }

    private function generateSingleSettlement(
        string $month,
        Performance $performance,
        \DateTimeInterface $startDate,
        \DateTimeInterface $endDate
    ): Settlement {
        $settlement = new Settlement();
        $settlement->setMonth($month);
        $settlement->setPerformanceId($performance->getId());
        $settlement->setPerformanceName($performance->getName());
        $settlement->setOrganizerId($performance->getOrganizer()->getId());
        $settlement->setOrganizerName($performance->getOrganizerName());

        $orderQb = $this->dm->getRepository(Order::class)->createQueryBuilder()
            ->field('performanceId')->equals($performance->getId())
            ->field('status')->in([Order::STATUS_PAID, Order::STATUS_REFUNDED, Order::STATUS_USED])
            ->field('paidAt')->gte($startDate)
            ->field('paidAt')->lte($endDate);

        $orders = $orderQb->getQuery()->toArray();

        $websiteRevenue = 0;
        $wechatRevenue = 0;
        $totalRefunds = 0;

        foreach ($orders as $order) {
            $settlementOrder = new SettlementOrder();
            $settlementOrder->setOrderId($order->getId());
            $settlementOrder->setOrderNo($order->getOrderNo());
            $settlementOrder->setSalesChannel($order->getSalesChannel());
            $settlementOrder->setAmount($order->getPayAmount());
            $settlementOrder->setIsMatched(true);

            $settlement->addOrder($settlementOrder);

            if ($order->getStatus() === Order::STATUS_REFUNDED) {
                $totalRefunds += $order->getRefundAmount() ?? $order->getPayAmount();
                continue;
            }

            if ($order->getSalesChannel() === Order::CHANNEL_WEBSITE) {
                $websiteRevenue += $order->getPayAmount();
            } else {
                $wechatRevenue += $order->getPayAmount();
            }
        }

        $totalRevenue = $websiteRevenue + $wechatRevenue;
        $serviceFee = round($totalRevenue * 0.05, 2);
        $netAmount = round($totalRevenue - $serviceFee - $totalRefunds, 2);

        $settlement->setWebsiteRevenue($websiteRevenue);
        $settlement->setWechatRevenue($wechatRevenue);
        $settlement->setTotalRevenue($totalRevenue);
        $settlement->setTotalRefunds($totalRefunds);
        $settlement->setServiceFee($serviceFee);
        $settlement->setNetAmount($netAmount);
        $settlement->setStatus(Settlement::STATUS_PENDING);

        $this->dm->persist($settlement);
        $this->dm->flush();

        return $settlement;
    }

    #[Route('/{id}/confirm-venue', name: 'api_settlements_confirm_venue', methods: ['POST'])]
    public function confirmByVenue(string $id): JsonResponse
    {
        $user = $this->getUser();
        if (!in_array($user->getRole(), [User::ROLE_VENUE_ADMIN, User::ROLE_FINANCE])) {
            return new JsonResponse(['message' => '权限不足'], 403);
        }

        $settlement = $this->dm->getRepository(Settlement::class)->find($id);
        if (!$settlement) {
            return new JsonResponse(['message' => '结算单不存在'], 404);
        }

        if ($settlement->getStatus() === Settlement::STATUS_COMPLETED) {
            return new JsonResponse(['message' => '结算单已完成，无需再次确认'], 400);
        }

        if ($settlement->getStatus() === Settlement::STATUS_CONFIRMED_ORGANIZER) {
            $settlement->setStatus(Settlement::STATUS_COMPLETED);
        } else {
            $settlement->setStatus(Settlement::STATUS_CONFIRMED_VENUE);
        }
        $settlement->setConfirmedVenueAt(new \DateTime());

        $this->dm->flush();

        return new JsonResponse([
            'message' => '场馆方已确认结算单',
            'settlement' => json_decode($this->serializer->serialize(
                $settlement,
                'json',
                ['groups' => ['settlement:read']]
            ), true)
        ]);
    }

    #[Route('/{id}/confirm-organizer', name: 'api_settlements_confirm_organizer', methods: ['POST'])]
    public function confirmByOrganizer(string $id): JsonResponse
    {
        $user = $this->getUser();

        $settlement = $this->dm->getRepository(Settlement::class)->find($id);
        if (!$settlement) {
            return new JsonResponse(['message' => '结算单不存在'], 404);
        }

        if ($user->getRole() === User::ROLE_ORGANIZER && $settlement->getOrganizerId() !== $user->getId()) {
            return new JsonResponse(['message' => '无权确认此结算单'], 403);
        }

        if ($settlement->getStatus() === Settlement::STATUS_COMPLETED) {
            return new JsonResponse(['message' => '结算单已完成，无需再次确认'], 400);
        }

        if ($settlement->getStatus() === Settlement::STATUS_CONFIRMED_VENUE) {
            $settlement->setStatus(Settlement::STATUS_COMPLETED);
        } else {
            $settlement->setStatus(Settlement::STATUS_CONFIRMED_ORGANIZER);
        }
        $settlement->setConfirmedOrganizerAt(new \DateTime());

        $this->dm->flush();

        return new JsonResponse([
            'message' => '主办方已确认结算单',
            'settlement' => json_decode($this->serializer->serialize(
                $settlement,
                'json',
                ['groups' => ['settlement:read']]
            ), true)
        ]);
    }

    #[Route('/sales-stats', name: 'api_settlements_sales_stats', methods: ['GET'])]
    public function salesStats(Request $request): JsonResponse
    {
        $startDate = $request->query->get('startDate');
        $endDate = $request->query->get('endDate');
        $performanceId = $request->query->get('performanceId');

        $qb = $this->dm->getRepository(Order::class)->createQueryBuilder()
            ->field('status')->in([Order::STATUS_PAID, Order::STATUS_USED]);

        if ($startDate) {
            $qb->field('paidAt')->gte(new \DateTime($startDate));
        }
        if ($endDate) {
            $qb->field('paidAt')->lte(new \DateTime($endDate));
        }
        if ($performanceId) {
            $qb->field('performanceId')->equals($performanceId);
        }

        $orders = $qb->getQuery()->toArray();

        $stats = [];
        $grouped = [];

        foreach ($orders as $order) {
            $perfId = $order->getPerformanceId();
            if (!isset($grouped[$perfId])) {
                $grouped[$perfId] = [
                    'performanceId' => $perfId,
                    'performanceName' => $order->getPerformanceName(),
                    'totalTickets' => 0,
                    'soldTickets' => 0,
                    'totalRevenue' => 0,
                    'byChannel' => [
                        Order::CHANNEL_WEBSITE => 0,
                        Order::CHANNEL_WECHAT_MINIAPP => 0
                    ],
                    'byTicketType' => [
                        Order::TICKET_EARLY_BIRD => 0,
                        Order::TICKET_REGULAR => 0,
                        Order::TICKET_STUDENT => 0,
                        Order::TICKET_GROUP => 0
                    ]
                ];
            }

            $seatCount = $order->getSeats()->count();
            $grouped[$perfId]['soldTickets'] += $seatCount;
            $grouped[$perfId]['totalRevenue'] += $order->getPayAmount();
            $grouped[$perfId]['byChannel'][$order->getSalesChannel()] += $order->getPayAmount();
            $grouped[$perfId]['byTicketType'][$order->getTicketType()] += $order->getPayAmount();
        }

        return new JsonResponse([
            'stats' => array_values($grouped),
            'summary' => [
                'totalRevenue' => array_reduce($grouped, fn($sum, $g) => $sum + $g['totalRevenue'], 0),
                'totalTickets' => array_reduce($grouped, fn($sum, $g) => $sum + $g['soldTickets'], 0),
                'orderCount' => count($orders)
            ]
        ]);
    }

    #[Route('/channel-comparison', name: 'api_settlements_channel_comparison', methods: ['GET'])]
    public function channelComparison(Request $request): JsonResponse
    {
        $startDate = $request->query->get('startDate');
        $endDate = $request->query->get('endDate');

        $qb = $this->dm->getRepository(Order::class)->createQueryBuilder()
            ->field('status')->in([Order::STATUS_PAID, Order::STATUS_USED]);

        if ($startDate) {
            $qb->field('paidAt')->gte(new \DateTime($startDate));
        }
        if ($endDate) {
            $qb->field('paidAt')->lte(new \DateTime($endDate));
        }

        $orders = $qb->getQuery()->toArray();

        $websiteOrders = [];
        $wechatOrders = [];

        foreach ($orders as $order) {
            if ($order->getSalesChannel() === Order::CHANNEL_WEBSITE) {
                $websiteOrders[$order->getOrderNo()] = $order->getPayAmount();
            } else {
                $wechatOrders[$order->getOrderNo()] = $order->getPayAmount();
            }
        }

        $websiteTotal = array_sum($websiteOrders);
        $wechatTotal = array_sum($wechatOrders);

        return new JsonResponse([
            'website' => [
                'total' => $websiteTotal,
                'orderCount' => count($websiteOrders)
            ],
            'wechat' => [
                'total' => $wechatTotal,
                'orderCount' => count($wechatOrders)
            ],
            'differences' => []
        ]);
    }

    #[Route('/{id}/export', name: 'api_settlements_export', methods: ['GET'])]
    public function export(string $id): StreamedResponse
    {
        $settlement = $this->dm->getRepository(Settlement::class)->find($id);
        if (!$settlement) {
            throw $this->createNotFoundException('结算单不存在');
        }

        $response = new StreamedResponse();
        $response->headers->set('Content-Type', 'text/csv; charset=UTF-8');
        $response->headers->set(
            'Content-Disposition',
            'attachment; filename="settlement_' . $settlement->getMonth() . '_' . $settlement->getPerformanceId() . '.csv"'
        );

        $response->setCallback(function () use ($settlement) {
            $handle = fopen('php://output', 'w');
            fprintf($handle, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($handle, ['演艺集团演出结算单']);
            fputcsv($handle, []);
            fputcsv($handle, ['月份', $settlement->getMonth()]);
            fputcsv($handle, ['演出名称', $settlement->getPerformanceName()]);
            fputcsv($handle, ['主办方', $settlement->getOrganizerName()]);
            fputcsv($handle, ['状态', $settlement->getStatus()]);
            fputcsv($handle, []);
            fputcsv($handle, ['收入明细']);
            fputcsv($handle, ['官网收入', $settlement->getWebsiteRevenue()]);
            fputcsv($handle, ['小程序收入', $settlement->getWechatRevenue()]);
            fputcsv($handle, ['总收入', $settlement->getTotalRevenue()]);
            fputcsv($handle, ['退款支出', $settlement->getTotalRefunds()]);
            fputcsv($handle, ['平台手续费(5%)', $settlement->getServiceFee()]);
            fputcsv($handle, ['应结算金额', $settlement->getNetAmount()]);
            fputcsv($handle, []);
            fputcsv($handle, ['订单明细']);
            fputcsv($handle, ['订单号', '销售渠道', '金额', '状态']);

            foreach ($settlement->getOrders() as $order) {
                fputcsv($handle, [
                    $order->getOrderNo(),
                    $order->getSalesChannel(),
                    $order->getAmount(),
                    $order->isMatched() ? '已匹配' : '差异'
                ]);
            }

            fclose($handle);
        });

        return $response;
    }
}
