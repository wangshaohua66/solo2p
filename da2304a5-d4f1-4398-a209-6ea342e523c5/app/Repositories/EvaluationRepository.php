<?php

namespace App\Repositories;

use App\Models\Evaluation;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class EvaluationRepository
{
    public function __construct(
        protected Evaluation $evaluation
    ) {}

    public function getEvaluationsBySchedule(int $scheduleId): Collection
    {
        return $this->evaluation->newQuery()
            ->where('schedule_id', $scheduleId)
            ->when(true, function ($query) {
                $query->selectRaw('*, CASE WHEN is_anonymous = 1 THEN NULL ELSE student_id END as visible_student_id');
            })
            ->with(['student' => function ($query) {
                $query->select('id', 'name');
            }])
            ->get()
            ->map(function ($evaluation) {
                if ($evaluation->is_anonymous) {
                    $evaluation->setRelation('student', null);
                }
                return $evaluation;
            });
    }

    public function getEvaluationsByTeacher(int $teacherId, string $semester): Collection
    {
        return $this->evaluation->newQuery()
            ->whereHas('schedule', function ($q) use ($teacherId, $semester) {
                $q->where('teacher_id', $teacherId)->where('semester', $semester);
            })
            ->with(['schedule.course'])
            ->get();
    }

    public function getTeacherRanking(int $teacherId, string $semester): array
    {
        $teacherAvg = $this->evaluation->newQuery()
            ->whereHas('schedule', function ($q) use ($teacherId, $semester) {
                $q->where('teacher_id', $teacherId)->where('semester', $semester);
            })
            ->avg('overall_score');

        $allTeacherAvgs = $this->evaluation->newQuery()
            ->whereHas('schedule', function ($q) use ($semester) {
                $q->where('semester', $semester);
            })
            ->join('schedules', 'evaluations.schedule_id', '=', 'schedules.id')
            ->groupBy('schedules.teacher_id')
            ->selectRaw('schedules.teacher_id, AVG(evaluations.overall_score) as avg_score')
            ->orderByDesc('avg_score')
            ->get();

        $rank = 1;
        foreach ($allTeacherAvgs as $index => $item) {
            if ($item->teacher_id == $teacherId) {
                $rank = $index + 1;
                break;
            }
        }

        return [
            'teacher_id' => $teacherId,
            'average_score' => $teacherAvg ? round($teacherAvg, 2) : null,
            'rank' => $rank,
            'total_teachers' => $allTeacherAvgs->count(),
        ];
    }

    public function hasEvaluated(int $studentId, int $scheduleId): bool
    {
        return $this->evaluation->newQuery()
            ->where('student_id', $studentId)
            ->where('schedule_id', $scheduleId)
            ->exists();
    }

    public function create(array $data): Evaluation
    {
        return $this->evaluation->newQuery()->create($data);
    }

    public function getAbnormalEvaluations(int $scheduleId): Collection
    {
        return $this->evaluation->newQuery()
            ->where('schedule_id', $scheduleId)
            ->where(function ($q) {
                $q->where(function ($sq) {
                    $sq->where('teaching_score', 1)
                        ->where('attitude_score', 1)
                        ->where('content_score', 1);
                })->orWhere(function ($sq) {
                    $sq->where('teaching_score', 10)
                        ->where('attitude_score', 10)
                        ->where('content_score', 10);
                });
            })
            ->get();
    }

    public function getFilteredEvaluations(int $scheduleId): Collection
    {
        $abnormalIds = $this->getAbnormalEvaluations($scheduleId)->pluck('id');

        return $this->evaluation->newQuery()
            ->where('schedule_id', $scheduleId)
            ->whereNotIn('id', $abnormalIds)
            ->get();
    }
}
