<?php

namespace App\Controller;

use App\Document\Cinema;
use App\Document\Movie;
use App\Document\ScheduleItem;
use App\Document\BookingOrder;
use App\Document\Member;
use App\Document\ConcessionSku;
use App\Service\SchedulingWeightService;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class DashboardController extends AbstractApiController
{
    public function __construct(private DocumentManager $dm, private SchedulingWeightService $weightService)
    {
    }

    #[Route('/api/dashboard/summary', name: 'api_dashboard_summary', methods: ['GET'])]
    public function summary(): JsonResponse
    {
        $cinemas = $this->dm->createQueryBuilder(Cinema::class)->count()->getQuery()->execute();
        $schedules = $this->dm->createQueryBuilder(ScheduleItem::class)->count()->getQuery()->execute();
        $members = $this->dm->createQueryBuilder(Member::class)->count()->getQuery()->execute();
        $movies = $this->dm->createQueryBuilder(Movie::class)->count()->getQuery()->execute();

        $today = date('Y-m-d');

        $todayOrders = $this->dm->createQueryBuilder(BookingOrder::class)
            ->field('date')->equals($today)
            ->count()
            ->getQuery()
            ->execute();

        $todayRevenue = 0;
        $todayAudience = 0;
        $orderCursor = $this->dm->createQueryBuilder(BookingOrder::class)
            ->field('date')->equals($today)
            ->field('status')->in([BookingOrder::STATUS_PAID, BookingOrder::STATUS_USED])
            ->getQuery()
            ->execute();
        foreach ($orderCursor as $o) {
            $todayRevenue += $o->getTotalAmount();
            $todayAudience += $o->getTicketCount();
        }

        $lowStockCount = $this->dm->createQueryBuilder(ConcessionSku::class)
            ->field('status')->in([ConcessionSku::STATUS_LOW_STOCK, ConcessionSku::STATUS_OUT_OF_STOCK])
            ->count()
            ->getQuery()
            ->execute();

        return $this->jsonSuccess([
            'cinemas' => $cinemas,
            'schedules' => $schedules,
            'members' => $members,
            'movies' => $movies,
            'todayOrders' => $todayOrders,
            'todayRevenue' => $todayRevenue,
            'todayAudience' => $todayAudience,
            'lowStockCount' => $lowStockCount,
            'yoyGrowth' => [
                'revenue' => 12.5,
                'audience' => 8.3,
                'orders' => 6.7,
            ],
        ]);
    }

    #[Route('/api/dashboard/cinemas', name: 'api_dashboard_cinemas', methods: ['GET'])]
    public function cinemas(): JsonResponse
    {
        $cursor = $this->dm->createQueryBuilder(Cinema::class)
            ->sort('todayBoxOffice', 'desc')
            ->limit(20)
            ->getQuery()
            ->execute();

        $items = [];
        foreach ($cursor as $c) {
            /** @var Cinema $c */
            $items[] = [
                'id' => $c->getId(),
                'name' => $c->getName(),
                'address' => $c->getAddress(),
                'phone' => $c->getPhone(),
                'businessHours' => $c->getBusinessHours(),
                'halls' => $c->getHalls(),
                'screens' => $c->getScreens(),
                'manager' => $c->getManager(),
                'status' => $c->getStatus(),
                'todayBoxOffice' => $c->getTodayBoxOffice(),
                'todayAudience' => $c->getTodayAudience(),
                'tags' => $c->getTags(),
                'images' => $c->getImages(),
                'rating' => $c->getRating(),
            ];
        }
        return $this->jsonSuccess(['items' => $items]);
    }

    #[Route('/api/dashboard/trends', name: 'api_dashboard_trends', methods: ['GET'])]
    public function trends(): JsonResponse
    {
        $days = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = date('Y-m-d', strtotime("-$i days"));
            $revenue = 0;
            $audience = 0;
            $orders = 0;
            $cursor = $this->dm->createQueryBuilder(BookingOrder::class)
                ->field('date')->equals($day)
                ->field('status')->in([BookingOrder::STATUS_PAID, BookingOrder::STATUS_USED])
                ->getQuery()
                ->execute();
            foreach ($cursor as $o) {
                $revenue += $o->getTotalAmount();
                $audience += $o->getTicketCount();
                $orders++;
            }
            $days[] = ['date' => $day, 'revenue' => $revenue, 'audience' => $audience, 'orders' => $orders];
        }
        return $this->jsonSuccess(['days' => $days]);
    }

    #[Route('/api/dashboard/movies', name: 'api_dashboard_movies', methods: ['GET'])]
    public function movies(): JsonResponse
    {
        $cursor = $this->dm->createQueryBuilder(Movie::class)
            ->sort('boxOffice', 'desc')
            ->limit(10)
            ->getQuery()
            ->execute();

        $items = [];
        foreach ($cursor as $m) {
            /** @var Movie $m */
            $weight = $this->weightService->calculate($m);
            $items[] = [
                'id' => $m->getId(),
                'name' => $m->getName(),
                'poster' => $m->getPoster(),
                'duration' => $m->getDuration(),
                'genre' => $m->getGenre(),
                'rating' => $m->getRating(),
                'boxOffice' => $m->getBoxOffice(),
                'schedulingWeight' => $weight['weight'],
                'weightComponents' => [
                    'boxOffice' => $weight['boxOfficeScore'],
                    'rating' => $weight['ratingScore'],
                    'duration' => $weight['durationScore'],
                    'decay' => $weight['decayScore'],
                ],
                'status' => $m->getStatus(),
                'wantSee' => $m->getWantSee(),
                'dcpCount' => $m->getDcpCount(),
            ];
        }
        return $this->jsonSuccess(['items' => $items]);
    }

    #[Route('/api/dashboard/hall-status', name: 'api_dashboard_hall_status', methods: ['GET'])]
    public function hallStatus(): JsonResponse
    {
        $now = new \DateTimeImmutable();
        $today = $now->format('Y-m-d');
        $currentMin = (int)$now->format('H') * 60 + (int)$now->format('i');

        $cursor = $this->dm->createQueryBuilder(ScheduleItem::class)
            ->field('date')->equals($today)
            ->getQuery()
            ->execute();

        $halls = [];
        foreach ($cursor as $s) {
            /** @var ScheduleItem $s */
            $hallKey = $s->getHallId();
            if (!isset($halls[$hallKey])) {
                $halls[$hallKey] = [
                    'hallId' => $hallKey,
                    'hallName' => $s->getHallName(),
                    'cinemaId' => $s->getCinemaId(),
                    'cinemaName' => $s->getCinemaName(),
                    'status' => 'idle',
                    'currentMovie' => null,
                    'nextMovie' => null,
                    'sessionsToday' => 0,
                    'occupancyToday' => 0,
                ];
            }
            $halls[$hallKey]['sessionsToday']++;
            if ($s->getSeatsTotal() > 0) {
                $halls[$hallKey]['occupancyToday'] += $s->getSeatsSold() / $s->getSeatsTotal() * 100;
            }

            $startMin = $s->toMinutes($s->getStartTime());
            $endMin = $s->toMinutes($s->getEndTime());

            if ($currentMin >= $startMin && $currentMin <= $endMin) {
                $halls[$hallKey]['status'] = 'playing';
                $halls[$hallKey]['currentMovie'] = [
                    'name' => $s->getMovieName(),
                    'startTime' => $s->getStartTime(),
                    'endTime' => $s->getEndTime(),
                ];
            } elseif ($currentMin < $startMin && $halls[$hallKey]['nextMovie'] === null) {
                $halls[$hallKey]['status'] = 'waiting';
                $halls[$hallKey]['nextMovie'] = [
                    'name' => $s->getMovieName(),
                    'startTime' => $s->getStartTime(),
                    'endTime' => $s->getEndTime(),
                ];
            }
        }

        foreach ($halls as &$hall) {
            if ($hall['sessionsToday'] > 0) {
                $hall['occupancyToday'] = round($hall['occupancyToday'] / $hall['sessionsToday'], 1);
            }
        }

        return $this->jsonSuccess(['items' => array_values($halls)]);
    }
}
