<?php

namespace App\Services;

use App\Models\Classroom;
use App\Models\Enrollment;
use App\Models\Schedule;
use App\Models\Student;
use App\Repositories\EnrollmentRepository;
use App\Repositories\ScheduleRepository;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class EnrollmentService
{
    protected int $rateLimit = 3000;
    protected string $rateLimitKey = 'enroll:rate_limit:';
    protected string $waitlistKeyPrefix = 'enroll:waitlist:';

    public function __construct(
        protected EnrollmentRepository $enrollmentRepository,
        protected ScheduleRepository $scheduleRepository,
        protected Classroom $classroom,
        protected Student $student
    ) {}

    public function enroll(int $studentId, int $scheduleId): array
    {
        DB::beginTransaction();

        try {
            $schedule = Schedule::findOrFail($scheduleId);

            if ($this->enrollmentRepository->getEnrollmentsByStudent($studentId, ['schedule_id' => $scheduleId, 'status' => 'enrolled'])->isNotEmpty()) {
                throw new \Exception('Already enrolled');
            }

            if ($this->checkTimeConflict($studentId, $schedule->semester, $schedule->day_of_week, $schedule->start_period, $schedule->end_period)) {
                throw new \Exception('Time conflict');
            }

            if ($this->checkCapacity($scheduleId)) {
                $enrollment = $this->enrollmentRepository->enroll($studentId, $scheduleId, 'enrolled');
                $status = 'enrolled';
            } else {
                $enrollment = $this->enrollmentRepository->enroll($studentId, $scheduleId, 'waitlisted');
                $this->addToWaitlist($studentId, $scheduleId);
                $status = 'waitlisted';
            }

            DB::commit();

            return ['status' => $status, 'enrollment' => $enrollment];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function drop(int $enrollmentId): array
    {
        DB::beginTransaction();

        try {
            $enrollment = $this->enrollmentRepository->drop($enrollmentId);
            $scheduleId = $enrollment->schedule_id;

            $promoted = null;

            if ($enrollment->status === 'dropped') {
                $promoted = $this->promoteFromWaitlist($scheduleId);
            }

            DB::commit();

            return ['status' => 'dropped', 'promoted' => $promoted];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function promoteFromWaitlist(int $scheduleId): ?Enrollment
    {
        $key = $this->waitlistKeyPrefix . $scheduleId;
        $result = Redis::zrange($key, 0, 0);

        if (empty($result)) {
            return null;
        }

        $studentId = (int) $result[0];

        $enrollment = $this->enrollmentRepository->promoteFromWaitlist($scheduleId);

        if ($enrollment) {
            $this->removeFromWaitlist($studentId, $scheduleId);
        }

        return $enrollment;
    }

    public function checkCapacity(int $scheduleId): bool
    {
        $enrolledCount = $this->getEnrolledCount($scheduleId);
        $schedule = Schedule::with('classroom')->findOrFail($scheduleId);

        return $enrolledCount < $schedule->classroom->capacity;
    }

    public function checkTimeConflict(int $studentId, string $semester, int $dayOfWeek, int $startPeriod, int $endPeriod): bool
    {
        return $this->enrollmentRepository->checkTimeConflict($studentId, $semester, $dayOfWeek, $startPeriod, $endPeriod);
    }

    public function rateLimit(int $studentId): bool
    {
        $key = $this->rateLimitKey . $studentId;
        $currentTime = Carbon::now()->getTimestamp();
        $windowStart = $currentTime - 60;

        Redis::zremrangebyscore($key, '-inf', $windowStart);

        $count = Redis::zcard($key);

        if ($count >= $this->rateLimit) {
            return false;
        }

        Redis::zadd($key, $currentTime, $currentTime . ':' . uniqid());
        Redis::expire($key, 60);

        return true;
    }

    public function addToWaitlist(int $studentId, int $scheduleId): void
    {
        $key = $this->waitlistKeyPrefix . $scheduleId;
        Redis::zadd($key, Carbon::now()->getTimestamp(), $studentId);
    }

    public function removeFromWaitlist(int $studentId, int $scheduleId): void
    {
        $key = $this->waitlistKeyPrefix . $scheduleId;
        Redis::zrem($key, $studentId);
    }

    public function getWaitlistPosition(int $studentId, int $scheduleId): int
    {
        $key = $this->waitlistKeyPrefix . $scheduleId;
        $position = Redis::zrank($key, $studentId);

        return $position !== false ? $position + 1 : 0;
    }

    public function getEnrollmentsByStudent(int $studentId, ?string $semester = null): Collection
    {
        $filters = [];

        if ($semester !== null) {
            $filters['semester'] = $semester;
        }

        return $this->enrollmentRepository->getEnrollmentsByStudent($studentId, $filters)->getCollection();
    }

    public function getEnrolledCount(int $scheduleId): int
    {
        return $this->enrollmentRepository->getEnrolledCount($scheduleId);
    }

    public function getWaitlistCount(int $scheduleId): int
    {
        $key = $this->waitlistKeyPrefix . $scheduleId;

        return (int) Redis::zcard($key);
    }

    public function processEnrollmentQueue(): void
    {
        $queueKey = 'enroll:queue';

        while ($payload = Redis::rpop($queueKey)) {
            try {
                $data = json_decode($payload, true);

                if (!isset($data['student_id'], $data['schedule_id'])) {
                    continue;
                }

                if ($this->rateLimit($data['student_id'])) {
                    $this->enroll($data['student_id'], $data['schedule_id']);
                }
            } catch (\Exception $e) {
                Redis::lpush($queueKey, $payload);
                usleep(100000);
            }
        }
    }
}