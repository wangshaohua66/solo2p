<?php

namespace App\Service;

use App\Document\Performance;
use Doctrine\ODM\MongoDB\DocumentManager;
use Doctrine\ODM\MongoDB\Repository\DocumentRepository;

class ScheduleService
{
    public const MIN_TRANSITION_MINUTES = 60;

    private DocumentManager $dm;
    private DocumentRepository $performanceRepo;

    public function __construct(DocumentManager $dm)
    {
        $this->dm = $dm;
        $this->performanceRepo = $dm->getRepository(Performance::class);
    }

    public function checkConflict(
        string $venueId,
        \DateTimeInterface $startTime,
        \DateTimeInterface $endTime,
        ?string $excludePerformanceId = null
    ): array {
        $conflicts = [];

        $qb = $this->performanceRepo->createQueryBuilder()
            ->field('venueId')->equals($venueId)
            ->field('status')->in([
                Performance::STATUS_APPROVED,
                Performance::STATUS_PENDING
            ])
            ->field('startTime')->exists(true)
            ->field('endTime')->exists(true);

        if ($excludePerformanceId) {
            $qb->field('id')->notEqual($excludePerformanceId);
        }

        $existingPerformances = $qb->getQuery()->execute();

        foreach ($existingPerformances as $perf) {
            $existingStart = $perf->getStartTime();
            $existingEnd = $perf->getEndTime();

            if (!$existingStart || !$existingEnd) {
                continue;
            }

            $startWithTransition = (clone $startTime)->modify('-' . self::MIN_TRANSITION_MINUTES . ' minutes');
            $endWithTransition = (clone $endTime)->modify('+' . self::MIN_TRANSITION_MINUTES . ' minutes');

            if (
                $startWithTransition < $existingEnd &&
                $endWithTransition > $existingStart
            ) {
                $transitionNeeded = false;
                if (
                    $startTime >= $existingEnd &&
                    $startTime < (clone $existingEnd)->modify('+' . self::MIN_TRANSITION_MINUTES . ' minutes')
                ) {
                    $transitionNeeded = true;
                }
                if (
                    $endTime <= $existingStart &&
                    $endTime > (clone $existingStart)->modify('-' . self::MIN_TRANSITION_MINUTES . ' minutes')
                ) {
                    $transitionNeeded = true;
                }

                $conflicts[] = [
                    'performance' => $perf,
                    'performanceId' => $perf->getId(),
                    'performanceName' => $perf->getName(),
                    'existingStartTime' => $existingStart,
                    'existingEndTime' => $existingEnd,
                    'transitionConflict' => $transitionNeeded,
                    'message' => $transitionNeeded
                        ? '与相邻场次转场时间不足（需至少' . self::MIN_TRANSITION_MINUTES . '分钟）'
                        : '档期时间重叠'
                ];
            }
        }

        return $conflicts;
    }

    public function getAvailableSlots(
        string $venueId,
        \DateTimeInterface $date,
        int $durationMinutes
    ): array {
        $slots = [];

        $dayStart = (clone $date)->setTime(8, 0, 0);
        $dayEnd = (clone $date)->setTime(23, 0, 0);

        $qb = $this->performanceRepo->createQueryBuilder()
            ->field('venueId')->equals($venueId)
            ->field('status')->equals(Performance::STATUS_APPROVED)
            ->field('startTime')->gte($dayStart)
            ->field('startTime')->lt((clone $date)->modify('+1 day'));

        $booked = $qb->getQuery()->toArray();

        $bookedPeriods = [];
        foreach ($booked as $perf) {
            if ($perf->getStartTime() && $perf->getEndTime()) {
                $bookedPeriods[] = [
                    'start' => (clone $perf->getStartTime())->modify('-' . self::MIN_TRANSITION_MINUTES . ' minutes'),
                    'end' => (clone $perf->getEndTime())->modify('+' . self::MIN_TRANSITION_MINUTES . ' minutes'),
                    'performance' => $perf
                ];
            }
        }

        usort($bookedPeriods, fn($a, $b) => $a['start'] <=> $b['start']);

        $currentStart = clone $dayStart;
        foreach ($bookedPeriods as $period) {
            if ($currentStart < $period['start']) {
                $slotEnd = $period['start'];
                $availableMinutes = ($slotEnd->getTimestamp() - $currentStart->getTimestamp()) / 60;

                if ($availableMinutes >= $durationMinutes) {
                    $slots[] = [
                        'start' => clone $currentStart,
                        'end' => clone $slotEnd,
                        'availableMinutes' => $availableMinutes
                    ];
                }
            }
            if ($period['end'] > $currentStart) {
                $currentStart = clone $period['end'];
            }
        }

        if ($currentStart < $dayEnd) {
            $availableMinutes = ($dayEnd->getTimestamp() - $currentStart->getTimestamp()) / 60;
            if ($availableMinutes >= $durationMinutes) {
                $slots[] = [
                    'start' => clone $currentStart,
                    'end' => clone $dayEnd,
                    'availableMinutes' => $availableMinutes
                ];
            }
        }

        return $slots;
    }

    public function getVenueCalendar(
        string $venueId,
        \DateTimeInterface $startDate,
        \DateTimeInterface $endDate
    ): array {
        $qb = $this->performanceRepo->createQueryBuilder()
            ->field('venueId')->equals($venueId)
            ->field('startTime')->gte($startDate)
            ->field('startTime')->lte($endDate);

        $performances = $qb->getQuery()->toArray();

        $events = [];
        foreach ($performances as $perf) {
            $events[] = [
                'id' => $perf->getId(),
                'title' => $perf->getName(),
                'start' => $perf->getStartTime()?->format('Y-m-d\TH:i:s'),
                'end' => $perf->getEndTime()?->format('Y-m-d\TH:i:s'),
                'status' => $perf->getStatus(),
                'type' => $perf->getType(),
                'venueName' => $perf->getVenueName()
            ];
        }

        return $events;
    }

    public function validateScheduleForApproval(
        string $venueId,
        \DateTimeInterface $startTime,
        \DateTimeInterface $endTime,
        ?string $excludePerformanceId = null
    ): array {
        $errors = [];

        if ($endTime <= $startTime) {
            $errors[] = '结束时间必须晚于开始时间';
        }

        $duration = ($endTime->getTimestamp() - $startTime->getTimestamp()) / 60;
        if ($duration < 30) {
            $errors[] = '演出时长不能少于30分钟';
        }
        if ($duration > 480) {
            $errors[] = '演出时长不能超过480分钟（8小时）';
        }

        $startHour = (int)$startTime->format('H');
        $endHour = (int)$endTime->format('H');
        if ($startHour < 8 || $endHour > 23) {
            $errors[] = '演出时间需在08:00-23:00之间';
        }

        $conflicts = $this->checkConflict($venueId, $startTime, $endTime, $excludePerformanceId);
        foreach ($conflicts as $conflict) {
            $errors[] = sprintf(
                '%s：《%s》(%s - %s)',
                $conflict['message'],
                $conflict['performanceName'],
                $conflict['existingStartTime']->format('H:i'),
                $conflict['existingEndTime']->format('H:i')
            );
        }

        return $errors;
    }
}
