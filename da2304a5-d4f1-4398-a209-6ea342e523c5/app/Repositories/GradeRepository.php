<?php

namespace App\Repositories;

use App\Models\Grade;
use App\Models\GradeComponent;
use App\Models\StudentGrade;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class GradeRepository
{
    public function __construct(
        protected Grade $grade
    ) {}

    public function getGradesByEnrollment(int $enrollmentId): Collection
    {
        return $this->grade->newQuery()
            ->where('enrollment_id', $enrollmentId)
            ->with('component')
            ->get();
    }

    public function getStudentGrades(int $studentId, ?string $semester = null): LengthAwarePaginator
    {
        $query = $this->grade->newQuery()
            ->whereHas('enrollment', function ($q) use ($studentId) {
                $q->where('student_id', $studentId);
            })
            ->with(['enrollment.schedule.course', 'component']);

        if ($semester !== null) {
            $query->whereHas('enrollment.schedule', function ($q) use ($semester) {
                $q->where('semester', $semester);
            });
        }

        return $query->paginate();
    }

    public function batchUpsertGrades(array $grades): int
    {
        $affected = 0;

        foreach ($grades as $gradeData) {
            $affected += DB::table('grades')->upsert(
                $gradeData,
                ['enrollment_id', 'component_id'],
                ['score', 'is_absent', 'graded_by', 'graded_at']
            );
        }

        return $affected;
    }

    public function getComponentWeights(int $courseId): Collection
    {
        return GradeComponent::query()
            ->where('course_id', $courseId)
            ->orderBy('sort_order')
            ->get();
    }

    public function calculateTotalScore(int $enrollmentId): ?float
    {
        $grades = $this->grade->newQuery()
            ->where('enrollment_id', $enrollmentId)
            ->where('is_absent', false)
            ->with('component')
            ->get();

        if ($grades->isEmpty()) {
            return null;
        }

        $total = 0.0;
        $totalWeight = 0.0;

        foreach ($grades as $grade) {
            $total += $grade->score * $grade->component->weight;
            $totalWeight += $grade->component->weight;
        }

        return $totalWeight > 0 ? round($total / $totalWeight, 2) : null;
    }

    public function getGradeDistribution(int $courseId, string $semester): array
    {
        $distribution = StudentGrade::query()
            ->whereHas('enrollment.schedule', function ($q) use ($courseId, $semester) {
                $q->where('course_id', $courseId)->where('semester', $semester);
            })
            ->select('letter_grade', DB::raw('COUNT(*) as count'))
            ->groupBy('letter_grade')
            ->pluck('count', 'letter_grade')
            ->toArray();

        return $distribution;
    }

    public function getFailedStudents(int $courseId, string $semester): Collection
    {
        return StudentGrade::query()
            ->whereHas('enrollment.schedule', function ($q) use ($courseId, $semester) {
                $q->where('course_id', $courseId)->where('semester', $semester);
            })
            ->where(function ($q) {
                $q->where('letter_grade', 'F')
                    ->orWhere('total_score', '<', 60);
            })
            ->with('enrollment.student')
            ->get();
    }
}
