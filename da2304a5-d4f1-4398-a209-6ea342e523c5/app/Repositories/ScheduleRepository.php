<?php

namespace App\Repositories;

use App\Models\Schedule;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class ScheduleRepository
{
    public function __construct(
        protected Schedule $schedule
    ) {}

    public function getSchedulesBySemester(string $semester, array $filters = []): LengthAwarePaginator
    {
        $query = $this->schedule->newQuery()
            ->where('semester', $semester)
            ->with(['course', 'teacher', 'classroom']);

        if (isset($filters['college_id'])) {
            $query->whereHas('course', function ($q) use ($filters) {
                $q->where('college_id', $filters['college_id']);
            });
        }

        if (isset($filters['teacher_id'])) {
            $query->where('teacher_id', $filters['teacher_id']);
        }

        if (isset($filters['classroom_id'])) {
            $query->where('classroom_id', $filters['classroom_id']);
        }

        if (isset($filters['day_of_week'])) {
            $query->where('day_of_week', $filters['day_of_week']);
        }

        return $query->orderBy('day_of_week')->orderBy('start_period')->paginate();
    }

    public function getSchedulesByStudent(int $studentId, string $semester, ?int $week = null): Collection
    {
        $query = $this->schedule->newQuery()
            ->where('semester', $semester)
            ->whereHas('enrollments', function ($q) use ($studentId) {
                $q->where('student_id', $studentId)->where('status', 'enrolled');
            })
            ->with(['course', 'teacher', 'classroom']);

        if ($week !== null) {
            $query->whereRaw("FIND_IN_SET(?, weeks)", [$week]);
        }

        return $query->orderBy('day_of_week')->orderBy('start_period')->get();
    }

    public function getSchedulesByTeacher(int $teacherId, string $semester): Collection
    {
        return $this->schedule->newQuery()
            ->where('teacher_id', $teacherId)
            ->where('semester', $semester)
            ->with(['course', 'classroom'])
            ->orderBy('day_of_week')
            ->orderBy('start_period')
            ->get();
    }

    public function getSchedulesByClassroom(int $classroomId, string $semester): Collection
    {
        return $this->schedule->newQuery()
            ->where('classroom_id', $classroomId)
            ->where('semester', $semester)
            ->with(['course', 'teacher'])
            ->orderBy('day_of_week')
            ->orderBy('start_period')
            ->get();
    }

    public function findConflicts(string $semester, int $teacherId, int $dayOfWeek, int $startPeriod, int $endPeriod, ?int $excludeId = null): Collection
    {
        $query = $this->schedule->newQuery()
            ->where('semester', $semester)
            ->where('teacher_id', $teacherId)
            ->where('day_of_week', $dayOfWeek)
            ->where('start_period', '<=', $endPeriod)
            ->where('end_period', '>=', $startPeriod);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->with(['course', 'classroom'])->get();
    }

    public function findClassroomConflicts(string $semester, int $classroomId, int $dayOfWeek, int $startPeriod, int $endPeriod, ?int $excludeId = null): Collection
    {
        $query = $this->schedule->newQuery()
            ->where('semester', $semester)
            ->where('classroom_id', $classroomId)
            ->where('day_of_week', $dayOfWeek)
            ->where('start_period', '<=', $endPeriod)
            ->where('end_period', '>=', $startPeriod);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->with(['course', 'teacher'])->get();
    }

    public function bulkCreate(array $schedules): Collection
    {
        $created = new Collection();

        foreach ($schedules as $scheduleData) {
            $created->push($this->schedule->newQuery()->create($scheduleData));
        }

        return $created;
    }

    public function update(int $id, array $data): Schedule
    {
        $schedule = $this->schedule->newQuery()->findOrFail($id);
        $schedule->update($data);
        return $schedule->fresh();
    }

    public function delete(int $id): bool
    {
        $schedule = $this->schedule->newQuery()->findOrFail($id);
        return $schedule->delete();
    }

    public function getLockedSchedules(string $semester): Collection
    {
        return $this->schedule->newQuery()
            ->where('semester', $semester)
            ->where('is_locked', true)
            ->with(['course', 'teacher', 'classroom'])
            ->get();
    }
}
