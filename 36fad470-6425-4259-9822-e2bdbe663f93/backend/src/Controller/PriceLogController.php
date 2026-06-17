<?php

namespace App\Controller;

use App\Document\PriceChangeLog;
use App\Document\Seat;
use App\Document\User;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/price-logs')]
class PriceLogController extends AbstractController
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

    #[Route('', name: 'api_price_logs_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user) {
            return new JsonResponse(['message' => '请先登录'], 401);
        }
        if (!in_array($user->getRole(), [User::ROLE_VENUE_ADMIN, User::ROLE_FINANCE])) {
            return new JsonResponse(['message' => '无权查看票价变更日志'], 403);
        }

        $qb = $this->dm->getRepository(PriceChangeLog::class)->createQueryBuilder()
            ->sort('createdAt', 'desc');

        $performanceId = $request->query->get('performanceId');
        if ($performanceId) {
            $qb->field('performanceId')->equals($performanceId);
        }

        $ticketType = $request->query->get('ticketType');
        if ($ticketType) {
            $qb->field('ticketType')->equals($ticketType);
        }

        $operatorId = $request->query->get('operatorId');
        if ($operatorId) {
            $qb->field('operatorId')->equals($operatorId);
        }

        $startDate = $request->query->get('startDate');
        if ($startDate) {
            try {
                $qb->field('createdAt')->gte(new \DateTime($startDate));
            } catch (\Exception) {}
        }

        $endDate = $request->query->get('endDate');
        if ($endDate) {
            try {
                $qb->field('createdAt')->lte(new \DateTime($endDate . ' 23:59:59'));
            } catch (\Exception) {}
        }

        $page = max(1, (int)$request->query->get('page', 1));
        $pageSize = max(1, min(100, (int)$request->query->get('pageSize', 20)));
        $skip = ($page - 1) * $pageSize;

        $qb->skip($skip)->limit($pageSize);

        $logs = $qb->getQuery()->toArray();

        $countQb = $this->dm->getRepository(PriceChangeLog::class)->createQueryBuilder();
        if ($performanceId) $countQb->field('performanceId')->equals($performanceId);
        if ($ticketType) $countQb->field('ticketType')->equals($ticketType);
        if ($operatorId) $countQb->field('operatorId')->equals($operatorId);
        if ($startDate) {
            try { $countQb->field('createdAt')->gte(new \DateTime($startDate)); } catch (\Exception) {}
        }
        if ($endDate) {
            try { $countQb->field('createdAt')->lte(new \DateTime($endDate . ' 23:59:59')); } catch (\Exception) {}
        }
        $total = $countQb->count()->getQuery()->execute();

        $ticketTypeMap = [
            Seat::TICKET_REGULAR => '普通票',
            Seat::TICKET_EARLY_BIRD => '早鸟票',
            Seat::TICKET_STUDENT => '学生票',
            Seat::TICKET_GROUP => '团体票'
        ];

        $logsWithLabels = array_map(function($log) use ($ticketTypeMap) {
            $arr = json_decode($this->serializer->serialize($log, 'json', ['groups' => ['price_log:read']]), true);
            $arr['ticketTypeLabel'] = $ticketTypeMap[$arr['ticketType']] ?? $arr['ticketType'];
            $arr['changeAmount'] = round($arr['newPrice'] - $arr['oldPrice'], 2);
            $arr['changePercent'] = $arr['oldPrice'] > 0 ?
                round(($arr['newPrice'] - $arr['oldPrice']) / $arr['oldPrice'] * 100, 2) : 0;
            return $arr;
        }, $logs);

        return new JsonResponse([
            'logs' => $logsWithLabels,
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'ticketTypes' => $ticketTypeMap
        ]);
    }

    #[Route('/summary', name: 'api_price_logs_summary', methods: ['GET'])]
    public function summary(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user) {
            return new JsonResponse(['message' => '请先登录'], 401);
        }
        if (!in_array($user->getRole(), [User::ROLE_VENUE_ADMIN, User::ROLE_FINANCE])) {
            return new JsonResponse(['message' => '无权查看'], 403);
        }

        $qb = $this->dm->getRepository(PriceChangeLog::class)->createQueryBuilder();
        $performanceId = $request->query->get('performanceId');
        if ($performanceId) {
            $qb->field('performanceId')->equals($performanceId);
        }
        $logs = $qb->sort('createdAt', 'desc')->getQuery()->toArray();

        $increaseCount = 0;
        $decreaseCount = 0;
        $totalChangeAmount = 0;
        $byTicketType = [];

        foreach ($logs as $log) {
            $diff = $log->getNewPrice() - $log->getOldPrice();
            if ($diff > 0) $increaseCount++;
            elseif ($diff < 0) $decreaseCount++;
            $totalChangeAmount += $diff;

            $tt = $log->getTicketType();
            if (!isset($byTicketType[$tt])) {
                $byTicketType[$tt] = ['count' => 0, 'totalDiff' => 0];
            }
            $byTicketType[$tt]['count']++;
            $byTicketType[$tt]['totalDiff'] += $diff;
        }

        return new JsonResponse([
            'totalChanges' => count($logs),
            'increases' => $increaseCount,
            'decreases' => $decreaseCount,
            'unchanged' => count($logs) - $increaseCount - $decreaseCount,
            'totalNetChange' => round($totalChangeAmount, 2),
            'byTicketType' => $byTicketType
        ]);
    }
}
