<?php

namespace App\Repositories;

use App\Models\Exam;
use App\Models\ExamProctor;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class ExamRepository
{
    public function __construct(
        protected Exam $exam
    ) {}

    public function getExamsBySemester(string $semester, array $filters = []): LengthAwarePaginator
    {
        $query = $this->exam->newQuery()
            ->whereHas('schedule', function ($q) use ($semester) {
                $q->where('semester', $semester);
            })
            ->with(['schedule.course', 'schedule.teacher', 'classroom']);

        if (isset($filters['exam_type'])) {
            $query->where('exam_type', $filters['exam_type']);
        }

        if (isset($filters['exam_date'])) {
            $query->where('exam_date', $filters['exam_date']);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->orderBy('exam_date')->orderBy('start_time')->paginate();
    }

    public function getExamsBySchedule(int $scheduleId): Collection
    {
        return $this->exam->newQuery()
            ->where('schedule_id', $scheduleId)
            ->with(['classroom', 'examProctors.teacher'])
            ->get();
    }

    public function getExamsByClassroom(int $classroomId, string $examDate): Collection
    {
        return $this->exam->newQuery()
            ->where('classroom_id', $classroomId)
            ->whereDate('exam_date', $examDate)
            ->with(['schedule.course', 'schedule.teacher'])
            ->get();
    }

    public function getProctorsByExam(int $examId): Collection
    {
        return ExamProctor::query()
            ->where('exam_id', $examId)
            ->with('teacher')
            ->get();
    }

    public function checkTeacherProctorConflict(int $teacherId, string $examDate, string $startTime, string $endTime, ?int $excludeExamId = null): bool
    {
        $query = ExamProctor::query()
            ->where('teacher_id', $teacherId)
            ->whereHas('exam', function ($q) use ($examDate, $startTime, $endTime) {
                $q->whereDate('exam_date', $examDate)
                    ->whereTime('start_time', '<', $endTime)
                    ->whereTime('end_time', '>', $startTime);
            });

        if ($excludeExamId !== null) {
            $query->where('exam_id', '!=', $excludeExamId);
        }

        return $query->exists();
    }

    public function checkTeacherIsCourseTeacher(int $teacherId, int $scheduleId): bool
    {
        return $this->exam->newQuery()
            ->where('schedule_id', $scheduleId)
            ->whereHas('schedule', function ($q) use ($teacherId) {
                $q->where('teacher_id', $teacherId);
            })
            ->exists();
    }

    public function assignProctors(int $examId, array $teacherIds): void
    {
        ExamProctor::query()->where('exam_id', $examId)->delete();

        $proctors = array_map(function ($teacherId) use ($examId) {
            return [
                'exam_id' => $examId,
                'teacher_id' => $teacherId,
            ];
        }, $teacherIds);

        ExamProctor::query()->insert($proctors);
    }

    public function bulkCreateExams(array $exams): Collection
    {
        $created = new Collection();

        foreach ($exams as $examData) {
            $created->push($this->exam->newQuery()->create($examData));
        }

        return $created;
    }
}
