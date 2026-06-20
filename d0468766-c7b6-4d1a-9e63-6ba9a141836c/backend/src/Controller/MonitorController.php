<?php

namespace App\Controller;

use App\Document\ScheduleItem;
use App\Document\Cinema;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class MonitorController extends AbstractApiController
{
    public function __construct(private DocumentManager $dm)
    {
    }

    #[Route('/api/monitor/halls', name: 'api_monitor_halls', methods: ['GET'])]
    public function halls(): JsonResponse
    {
        $now = new \DateTimeImmutable();
        $today = $now->format('Y-m-d');
        $currentMin = (int)$now->format('H') * 60 + (int)$now->format('i');

        $schedules = $this->dm->createQueryBuilder(ScheduleItem::class)
            ->field('date')->equals($today)
            ->sort('startTime', 'asc')
            ->getQuery()
            ->execute();

        $halls = [];
        foreach ($schedules as $s) {
            /** @var ScheduleItem $s */
            $key = $s->getCinemaId() . '_' . $s->getHallId();
            if (!isset($halls[$key])) {
                $halls[$key] = [
                    'id' => $key,
                    'cinemaId' => $s->getCinemaId(),
                    'cinemaName' => $s->getCinemaName(),
                    'hallId' => $s->getHallId(),
                    'hallName' => $s->getHallName(),
                    'hallType' => $s->getHallType(),
                    'status' => 'idle',
                    'currentSession' => null,
                    'upcomingSessions' => [],
                    'completedSessions' => [],
                    'totalSeats' => 0,
                    'seatsSoldToday' => 0,
                    'sessionsToday' => 0,
                    'deviceStatus' => [
                        'projector' => 'online',
                        'server' => 'online',
                        'audio' => 'online',
                        'lights' => 'online',
                    ],
                    'alerts' => [],
                ];
            }

            $halls[$key]['sessionsToday']++;
            $halls[$key]['totalSeats'] += $s->getSeatsTotal();
            $halls[$key]['seatsSoldToday'] += $s->getSeatsSold();

            $startMin = $s->toMinutes($s->getStartTime());
            $endMin = $s->toMinutes($s->getEndTime());

            $sessionData = [
                'id' => $s->getId(),
                'movieName' => $s->getMovieName(),
                'startTime' => $s->getStartTime(),
                'endTime' => $s->getEndTime(),
                'seatsTotal' => $s->getSeatsTotal(),
                'seatsSold' => $s->getSeatsSold(),
                'occupancy' => $s->getSeatsTotal() > 0 ? round($s->getSeatsSold() / $s->getSeatsTotal() * 100, 1) : 0,
                'status' => $s->getStatus(),
                'version' => $s->getVersion(),
                'language' => $s->getLanguage(),
                'price' => $s->getPrice(),
            ];

            if ($currentMin >= $endMin) {
                $halls[$key]['completedSessions'][] = $sessionData;
            } elseif ($currentMin >= $startMin && $currentMin < $endMin) {
                $halls[$key]['status'] = 'playing';
                $halls[$key]['currentSession'] = array_merge($sessionData, [
                    'progressPercent' => $currentMin <= $startMin ? 0 : min(100, round(($currentMin - $startMin) / max(1, $endMin - $startMin) * 100, 1)),
                    'elapsedMin' => max(0, $currentMin - $startMin),
                    'remainingMin' => max(0, $endMin - $currentMin),
                ]);
            } else {
                $halls[$key]['upcomingSessions'][] = $sessionData;
                if (count($halls[$key]['upcomingSessions']) === 1 && $halls[$key]['status'] === 'idle') {
                    $halls[$key]['status'] = 'waiting';
                }
            }
        }

        foreach ($halls as &$hall) {
            if ($hall['sessionsToday'] > 0 && $hall['totalSeats'] > 0) {
                $hall['occupancyRateToday'] = round($hall['seatsSoldToday'] / $hall['totalSeats'] * 100, 1);
            } else {
                $hall['occupancyRateToday'] = 0;
            }
            $hall['upcomingSessions'] = array_slice($hall['upcomingSessions'], 0, 3);
        }

        return $this->jsonSuccess(['items' => array_values($halls), 'total' => count($halls)]);
    }

    #[Route('/api/monitor/overview', name: 'api_monitor_overview', methods: ['GET'])]
    public function overview(): JsonResponse
    {
        $now = new \DateTimeImmutable();
        $today = $now->format('Y-m-d');

        $cinemaCount = $this->dm->createQueryBuilder(Cinema::class)->count()->getQuery()->execute();
        $sessionCursor = $this->dm->createQueryBuilder(ScheduleItem::class)
            ->field('date')->equals($today)
            ->getQuery()
            ->execute();

        $halls = [];
        $totalSessions = 0;
        $playing = 0;
        $waiting = 0;
        $completed = 0;

        $currentMin = (int)$now->format('H') * 60 + (int)$now->format('i');

        foreach ($sessionCursor as $s) {
            $totalSessions++;
            $halls[$s->getCinemaId() . '_' . $s->getHallId()] = true;
            $startMin = $s->toMinutes($s->getStartTime());
            $endMin = $s->toMinutes($s->getEndTime());
            if ($currentMin >= $endMin) $completed++;
            elseif ($currentMin >= $startMin) $playing++;
            else $waiting++;
        }

        return $this->jsonSuccess([
            'cinemas' => $cinemaCount,
            'hallsActive' => count($halls),
            'totalSessions' => $totalSessions,
            'playing' => $playing,
            'waiting' => $waiting,
            'completed' => $completed,
            'deviceStats' => [
                'online' => count($halls) * 4,
                'warning' => 0,
                'error' => 0,
            ],
            'timestamp' => $now->format(\DateTimeInterface::ATOM),
        ]);
    }

    #[Route('/api/monitor/alerts', name: 'api_monitor_alerts', methods: ['GET'])]
    public function alerts(): JsonResponse
    {
        $alerts = [];
        $now = new \DateTimeImmutable();
        $today = $now->format('Y-m-d');
        $currentMin = (int)$now->format('H') * 60 + (int)$now->format('i');

        $cursor = $this->dm->createQueryBuilder(ScheduleItem::class)
            ->field('date')->equals($today)
            ->getQuery()
            ->execute();

        foreach ($cursor as $s) {
            $startMin = $s->toMinutes($s->getStartTime());
            if ($currentMin >= $startMin - 5 && $currentMin <= $startMin && $s->getStatus() !== 'playing') {
                $alerts[] = [
                    'id' => 'alert_' . $s->getId(),
                    'type' => 'warning',
                    'severity' => 'warning',
                    'cinemaName' => $s->getCinemaName(),
                    'hallName' => $s->getHallName(),
                    'message' => sprintf(
                        '《%s》即将于 %s 开始播放，请检查设备状态',
                        $s->getMovieName(),
                        $s->getStartTime()
                    ),
                    'timestamp' => $now->format(\DateTimeInterface::ATOM),
                ];
            }
        }

        return $this->jsonSuccess(['items' => $alerts, 'total' => count($alerts)]);
    }
}
