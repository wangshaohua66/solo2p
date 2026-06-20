<?php

namespace App\Service;

use App\Document\ScheduleItem;
use Doctrine\ODM\MongoDB\DocumentManager;
use Doctrine\ODM\MongoDB\Iterator\Iterator;

readonly class ScheduleConflictService
{
    public function __construct(private DocumentManager $dm)
    {
    }

    public function detectConflict(
        string $hallId,
        string $date,
        string $startTime,
        string $endTime,
        int $cleaningMinutes = ScheduleItem::CLEANING_MINUTES,
        ?string $excludeScheduleId = null
    ): array {
        $startMin = $this->toMinutes($startTime) - $cleaningMinutes;
        $endMin = $this->toMinutes($endTime) + $cleaningMinutes;

        $qb = $this->dm->createQueryBuilder(ScheduleItem::class)
            ->field('hallId')->equals($hallId)
            ->field('date')->equals($date);

        if ($excludeScheduleId !== null) {
            $qb->field('id')->notEqual($excludeScheduleId);
        }

        $cursor = $qb->getQuery()->execute();

        foreach ($cursor as $s) {
            /** @var ScheduleItem $s */
            $sStart = $s->toMinutes($s->getStartTime());
            $sEnd = $s->toMinutes($s->getEndTime());

            if (!($endMin <= $sStart || $startMin >= $sEnd)) {
                $pureOverlap = min($this->toMinutes($endTime), $sEnd) - max($this->toMinutes($startTime), $sStart);
                $isCleaningConflict = $pureOverlap <= 0;
                $reason = $isCleaningConflict
                    ? sprintf(
                        '%s 清洁间隔冲突：《%s》%s-%s 结束后需预留%d分钟清洁时间',
                        $s->getHallName(),
                        $s->getMovieName(),
                        $s->getStartTime(),
                        $s->getEndTime(),
                        $cleaningMinutes
                    )
                    : sprintf(
                        '%s 该时段已有《%s》%s-%s 场次',
                        $s->getHallName(),
                        $s->getMovieName(),
                        $s->getStartTime(),
                        $s->getEndTime()
                    );
                return [
                    'conflict' => true,
                    'reason' => $reason,
                    'conflictSchedule' => $s,
                    'isCleaningConflict' => $isCleaningConflict,
                ];
            }
        }

        return ['conflict' => false, 'reason' => ''];
    }

    private function toMinutes(string $time): int
    {
        [$h, $m] = explode(':', $time);
        return (int)$h * 60 + (int)$m;
    }
}
