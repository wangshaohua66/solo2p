<?php

namespace App\Repositories;

use App\Models\Enrollment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class EnrollmentRepository
{
    public function __construct(
        protected Enrollment $enrollment
    ) {}

    public function getEnrollmentsByStudent(int $studentId, array $filters = []): LengthAwarePaginator
    {
        $query = $this->enrollment->newQuery()
            ->where('student_id', $studentId)
            ->with(['schedule.course', 'schedule.teacher']);

        if (isset($filters['semester'])) {
            $query->whereHas('schedule', function ($q) use ($filters) {
                $q->where('semester', $filters['semester']);
            });
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['course_type'])) {
            $query->whereHas('schedule.course', function ($q) use ($filters) {
                $q->where('type', $filters['course_type']);
            });
        }

        return $query->orderBy('enrolled_at', 'desc')->paginate();
    }

    public function getEnrollmentsBySchedule(int $scheduleId): Collection
    {
        return $this->enrollment->newQuery()
            ->where('schedule_id', $scheduleId)
            ->where('status', 'enrolled')
            ->with('student')
            ->get();
    }

    public function getEnrolledCount(int $scheduleId): int
    {
        return $this->enrollment->newQuery()
            ->where('schedule_id', $scheduleId)
            ->where('status', 'enrolled')
            ->count();
    }

    public function getWaitlistedStudents(int $scheduleId): Collection
    {
        return $this->enrollment->newQuery()
            ->where('schedule_id', $scheduleId)
            ->where('status', 'waitlisted')
            ->with('student')
            ->orderBy('enrolled_at')
            ->get();
    }

    public function enroll(int $studentId, int $scheduleId, string $status = 'enrolled'): Enrollment
    {
        return $this->enrollment->newQuery()->create([
            'student_id' => $studentId,
            'schedule_id' => $scheduleId,
            'status' => $status,
            'enrolled_at' => now(),
        ]);
    }

    public function drop(int $enrollmentId): Enrollment
    {
        $enrollment = $this->enrollment->newQuery()->findOrFail($enrollmentId);
        $enrollment->update([
            'status' => 'dropped',
            'dropped_at' => now(),
        ]);
        return $enrollment->fresh();
    }

    public function promoteFromWaitlist(int $scheduleId): ?Enrollment
    {
        $waitlisted = $this->enrollment->newQuery()
            ->where('schedule_id', $scheduleId)
            ->where('status', 'waitlisted')
            ->orderBy('enrolled_at')
            ->first();

        if (!$waitlisted) {
            return null;
        }

        $waitlisted->update(['status' => 'enrolled']);
        return $waitlisted->fresh();
    }

    public function getStudentSemesterCredits(int $studentId, string $semester): float
    {
        return (float) $this->enrollment->newQuery()
            ->where('student_id', $studentId)
            ->where('status', 'enrolled')
            ->whereHas('schedule', function ($q) use ($semester) {
                $q->where('semester', $semester);
            })
            ->join('schedules', 'enrollments.schedule_id', '=', 'schedules.id')
            ->join('courses', 'schedules.course_id', '=', 'courses.id')
            ->sum('courses.credits');
    }

    public function checkTimeConflict(int $studentId, string $semester, int $dayOfWeek, int $startPeriod, int $endPeriod): bool
    {
        return $this->enrollment->newQuery()
            ->where('student_id', $studentId)
            ->where('status', 'enrolled')
            ->whereHas('schedule', function ($q) use ($semester, $dayOfWeek, $startPeriod, $endPeriod) {
                $q->where('semester', $semester)
                    ->where('day_of_week', $dayOfWeek)
                    ->where('start_period', '<=', $endPeriod)
                    ->where('end_period', '>=', $startPeriod);
            })
            ->exists();
    }
}
