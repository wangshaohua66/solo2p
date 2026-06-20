<?php

namespace App\Controller;

use App\Document\ScheduleItem;
use App\Document\Movie;
use App\Service\ScheduleConflictService;
use App\Service\SchedulingWeightService;
use Doctrine\ODM\MongoDB\DocumentManager;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class ScheduleController extends AbstractApiController
{
    public function __construct(
        private DocumentManager $dm,
        private ScheduleConflictService $conflictService,
        private SchedulingWeightService $weightService
    ) {
    }

    #[Route('/api/schedules', name: 'api_schedule_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $cinemaId = $request->query->get('cinemaId');
        $date = $request->query->get('date');
        $hallId = $request->query->get('hallId');

        $qb = $this->dm->createQueryBuilder(ScheduleItem::class);

        if ($cinemaId) {
            $qb->field('cinemaId')->equals($cinemaId);
        }
        if ($date) {
            $qb->field('date')->equals($date);
        }
        if ($hallId) {
            $qb->field('hallId')->equals($hallId);
        }

        $qb->sort('date', 'asc')->sort('startTime', 'asc');
        $cursor = $qb->getQuery()->execute();

        $items = [];
        foreach ($cursor as $s) {
            /** @var ScheduleItem $s */
            $items[] = $this->serializeSchedule($s);
        }

        return $this->jsonSuccess(['items' => $items, 'total' => count($items)]);
    }

    #[Route('/api/schedules/{id}', name: 'api_schedule_detail', methods: ['GET'])]
    public function detail(string $id): JsonResponse
    {
        $schedule = $this->dm->getRepository(ScheduleItem::class)->find($id);
        if (!$schedule) {
            return $this->jsonError('排片不存在', 404, 'NOT_FOUND');
        }
        return $this->jsonSuccess($this->serializeSchedule($schedule));
    }

    #[Route('/api/schedules', name: 'api_schedule_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);

        $required = ['movieId', 'cinemaId', 'hallId', 'date', 'startTime', 'endTime', 'price', 'seatsTotal'];
        foreach ($required as $k) {
            if (!isset($body[$k])) {
                return $this->jsonError('缺少必要字段: ' . $k, 400, 'MISSING_FIELD');
            }
        }

        $cleaningMinutes = (int)($body['cleaningMinutes'] ?? ScheduleItem::CLEANING_MINUTES);

        $conflict = $this->conflictService->detectConflict(
            $body['hallId'],
            $body['date'],
            $body['startTime'],
            $body['endTime'],
            $cleaningMinutes
        );

        if ($conflict['conflict']) {
            return $this->jsonError($conflict['reason'], 409, 'SCHEDULE_CONFLICT', [
                'conflictSchedule' => $conflict['conflictSchedule'] ? $this->serializeSchedule($conflict['conflictSchedule']) : null,
                'isCleaningConflict' => $conflict['isCleaningConflict'] ?? false,
            ]);
        }

        $movie = $this->dm->getRepository(Movie::class)->find($body['movieId']);
        $movieName = $movie ? $movie->getName() : ($body['movieName'] ?? '未知影片');

        $schedule = new ScheduleItem();
        $schedule->setId($body['id'] ?? uniqid('sch_', true));
        $schedule->setMovieId($body['movieId']);
        $schedule->setMovieName($movieName);
        $schedule->setCinemaId($body['cinemaId']);
        $schedule->setCinemaName($body['cinemaName'] ?? '');
        $schedule->setHallId($body['hallId']);
        $schedule->setHallName($body['hallName'] ?? '');
        $schedule->setHallType($body['hallType'] ?? '标准厅');
        $schedule->setDate($body['date']);
        $schedule->setStartTime($body['startTime']);
        $schedule->setEndTime($body['endTime']);
        $schedule->setPrice((int)$body['price']);
        $schedule->setSeatsTotal((int)$body['seatsTotal']);
        $schedule->setSeatsSold((int)($body['seatsSold'] ?? 0));
        $schedule->setStatus($body['status'] ?? 'planned');
        $schedule->setLanguage($body['language'] ?? '国语');
        $schedule->setVersion($body['version'] ?? '2D');

        if ($movie) {
            $weightResult = $this->weightService->calculate($movie);
            $schedule->setWeight($weightResult['weight']);
        } else {
            $schedule->setWeight((float)($body['weight'] ?? 0.5));
        }

        $this->dm->persist($schedule);
        $this->dm->flush();

        return $this->jsonSuccess($this->serializeSchedule($schedule), 201);
    }

    #[Route('/api/schedules/{id}', name: 'api_schedule_update', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $schedule = $this->dm->getRepository(ScheduleItem::class)->find($id);
        if (!$schedule) {
            return $this->jsonError('排片不存在', 404, 'NOT_FOUND');
        }

        $body = $this->getJsonBody($request);

        $hallId = $body['hallId'] ?? $schedule->getHallId();
        $date = $body['date'] ?? $schedule->getDate();
        $startTime = $body['startTime'] ?? $schedule->getStartTime();
        $endTime = $body['endTime'] ?? $schedule->getEndTime();
        $cleaningMinutes = (int)($body['cleaningMinutes'] ?? ScheduleItem::CLEANING_MINUTES);

        $hallChanged = $hallId !== $schedule->getHallId();
        $timeChanged = $date !== $schedule->getDate() || $startTime !== $schedule->getStartTime() || $endTime !== $schedule->getEndTime();

        if ($hallChanged || $timeChanged) {
            $conflict = $this->conflictService->detectConflict($hallId, $date, $startTime, $endTime, $cleaningMinutes, $id);
            if ($conflict['conflict']) {
                return $this->jsonError($conflict['reason'], 409, 'SCHEDULE_CONFLICT', [
                    'conflictSchedule' => $conflict['conflictSchedule'] ? $this->serializeSchedule($conflict['conflictSchedule']) : null,
                    'isCleaningConflict' => $conflict['isCleaningConflict'] ?? false,
                ]);
            }
        }

        if (isset($body['movieId'])) {
            $schedule->setMovieId($body['movieId']);
            $movie = $this->dm->getRepository(Movie::class)->find($body['movieId']);
            if ($movie) {
                $schedule->setMovieName($movie->getName());
                $weightResult = $this->weightService->calculate($movie);
                $schedule->setWeight($weightResult['weight']);
            }
        }
        if (isset($body['movieName'])) $schedule->setMovieName($body['movieName']);
        if (isset($body['cinemaId'])) $schedule->setCinemaId($body['cinemaId']);
        if (isset($body['cinemaName'])) $schedule->setCinemaName($body['cinemaName']);
        if (isset($body['hallId'])) $schedule->setHallId($body['hallId']);
        if (isset($body['hallName'])) $schedule->setHallName($body['hallName']);
        if (isset($body['hallType'])) $schedule->setHallType($body['hallType']);
        if (isset($body['date'])) $schedule->setDate($body['date']);
        if (isset($body['startTime'])) $schedule->setStartTime($body['startTime']);
        if (isset($body['endTime'])) $schedule->setEndTime($body['endTime']);
        if (isset($body['price'])) $schedule->setPrice((int)$body['price']);
        if (isset($body['seatsTotal'])) $schedule->setSeatsTotal((int)$body['seatsTotal']);
        if (isset($body['seatsSold'])) $schedule->setSeatsSold((int)$body['seatsSold']);
        if (isset($body['status'])) $schedule->setStatus($body['status']);
        if (isset($body['weight'])) $schedule->setWeight((float)$body['weight']);
        if (isset($body['language'])) $schedule->setLanguage($body['language']);
        if (isset($body['version'])) $schedule->setVersion($body['version']);

        $this->dm->flush();

        return $this->jsonSuccess($this->serializeSchedule($schedule));
    }

    #[Route('/api/schedules/{id}', name: 'api_schedule_delete', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $schedule = $this->dm->getRepository(ScheduleItem::class)->find($id);
        if (!$schedule) {
            return $this->jsonError('排片不存在', 404, 'NOT_FOUND');
        }
        $this->dm->remove($schedule);
        $this->dm->flush();
        return $this->jsonSuccess(['deleted' => true, 'id' => $id]);
    }

    #[Route('/api/schedules/detect-conflict', name: 'api_schedule_detect_conflict', methods: ['POST'])]
    public function detectConflict(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);
        $hallId = $body['hallId'] ?? '';
        $date = $body['date'] ?? '';
        $startTime = $body['startTime'] ?? '';
        $endTime = $body['endTime'] ?? '';
        $cleaningMinutes = (int)($body['cleaningMinutes'] ?? ScheduleItem::CLEANING_MINUTES);
        $excludeId = $body['excludeScheduleId'] ?? null;

        if (empty($hallId) || empty($date) || empty($startTime) || empty($endTime)) {
            return $this->jsonError('缺少必要字段', 400, 'MISSING_FIELD');
        }

        $result = $this->conflictService->detectConflict($hallId, $date, $startTime, $endTime, $cleaningMinutes, $excludeId);
        return $this->jsonSuccess($result);
    }

    #[Route('/api/schedules/calculate-weight', name: 'api_schedule_calculate_weight', methods: ['POST'])]
    public function calculateWeight(Request $request): JsonResponse
    {
        $body = $this->getJsonBody($request);
        $movieIds = $body['movieIds'] ?? [];

        if (empty($movieIds)) {
            $this->weightService->recalculateAll();
            $cursor = $this->dm->createQueryBuilder(Movie::class)->getQuery()->execute();
            $results = [];
            foreach ($cursor as $m) {
                /** @var Movie $m */
                $results[] = $this->weightService->calculate($m);
            }
            return $this->jsonSuccess(['results' => $results, 'recalculated' => true]);
        }

        $results = [];
        foreach ($movieIds as $mid) {
            $movie = $this->dm->getRepository(Movie::class)->find($mid);
            if ($movie) {
                $results[] = $this->weightService->calculate($movie, $body['daysSinceRelease'] ?? null);
            }
        }
        return $this->jsonSuccess(['results' => $results, 'recalculated' => false]);
    }

    private function serializeSchedule(ScheduleItem $s): array
    {
        return [
            'id' => $s->getId(),
            'movieId' => $s->getMovieId(),
            'movieName' => $s->getMovieName(),
            'cinemaId' => $s->getCinemaId(),
            'cinemaName' => $s->getCinemaName(),
            'hallId' => $s->getHallId(),
            'hallName' => $s->getHallName(),
            'hallType' => $s->getHallType(),
            'date' => $s->getDate(),
            'startTime' => $s->getStartTime(),
            'endTime' => $s->getEndTime(),
            'price' => $s->getPrice(),
            'seatsTotal' => $s->getSeatsTotal(),
            'seatsSold' => $s->getSeatsSold(),
            'occupancy' => $s->getSeatsTotal() > 0 ? round($s->getSeatsSold() / $s->getSeatsTotal() * 100, 1) : 0,
            'status' => $s->getStatus(),
            'weight' => $s->getWeight(),
            'language' => $s->getLanguage(),
            'version' => $s->getVersion(),
        ];
    }
}
