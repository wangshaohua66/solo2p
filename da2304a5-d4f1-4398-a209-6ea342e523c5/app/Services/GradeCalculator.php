<?php

namespace App\Services;

use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\GradeComponent;
use App\Models\StudentGrade;

class GradeCalculator
{
    protected $gradePointTable = [
        ['min' => 90, 'max' => 100, 'gpa' => 4.0],
        ['min' => 85, 'max' => 89, 'gpa' => 3.7],
        ['min' => 82, 'max' => 84, 'gpa' => 3.3],
        ['min' => 78, 'max' => 81, 'gpa' => 3.0],
        ['min' => 75, 'max' => 77, 'gpa' => 2.7],
        ['min' => 72, 'max' => 74, 'gpa' => 2.3],
        ['min' => 68, 'max' => 71, 'gpa' => 2.0],
        ['min' => 64, 'max' => 67, 'gpa' => 1.5],
        ['min' => 60, 'max' => 63, 'gpa' => 1.0],
        ['min' => 0, 'max' => 59, 'gpa' => 0.0],
    ];

    protected $letterGradeTable = [
        ['min' => 90, 'max' => 100, 'grade' => 'A'],
        ['min' => 85, 'max' => 89, 'grade' => 'B+'],
        ['min' => 80, 'max' => 84, 'grade' => 'B'],
        ['min' => 75, 'max' => 79, 'grade' => 'C+'],
        ['min' => 70, 'max' => 74, 'grade' => 'C'],
        ['min' => 65, 'max' => 69, 'grade' => 'D+'],
        ['min' => 60, 'max' => 64, 'grade' => 'D'],
        ['min' => 0, 'max' => 59, 'grade' => 'F'],
    ];

    public function __construct(
        protected Grade $gradeModel,
        protected GradeComponent $gradeComponentModel,
        protected StudentGrade $studentGradeModel,
        protected Enrollment $enrollmentModel
    ) {
    }

    public function calculateTotalScore(int $enrollmentId): float
    {
        $enrollment = $this->enrollmentModel->with('schedule.course')->findOrFail($enrollmentId);
        $courseId = $enrollment->schedule->course->id;

        $components = $this->gradeComponentModel->where('course_id', $courseId)->get();
        $grades = $this->gradeModel->where('enrollment_id', $enrollmentId)->get()->keyBy('component_id');

        $weightedSum = 0.0;
        $totalWeight = 0.0;

        foreach ($components as $component) {
            $grade = $grades->get($component->id);
            
            if ($grade && $grade->is_absent) {
                $score = 0.0;
            } elseif ($grade) {
                $score = $grade->score;
            } else {
                $score = 0.0;
            }

            $weightedSum += $score * $component->weight;
            $totalWeight += $component->weight;
        }

        return $totalWeight > 0 ? $weightedSum / $totalWeight : 0.0;
    }

    public function calculateGradePoint(float $totalScore): float
    {
        foreach ($this->gradePointTable as $range) {
            if ($totalScore >= $range['min'] && $totalScore <= $range['max']) {
                return $range['gpa'];
            }
        }

        return 0.0;
    }

    public function calculateLetterGrade(float $totalScore): string
    {
        foreach ($this->letterGradeTable as $range) {
            if ($totalScore >= $range['min'] && $totalScore <= $range['max']) {
                return $range['grade'];
            }
        }

        return 'F';
    }

    public function updateStudentGrade(int $enrollmentId): StudentGrade
    {
        $totalScore = $this->calculateTotalScore($enrollmentId);
        $gradePoint = $this->calculateGradePoint($totalScore);
        $letterGrade = $this->calculateLetterGrade($totalScore);
        $isRetake = $this->isFailed($totalScore);

        return $this->studentGradeModel->updateOrCreate(
            ['enrollment_id' => $enrollmentId],
            [
                'total_score' => $totalScore,
                'grade_point' => $gradePoint,
                'letter_grade' => $letterGrade,
                'is_retake' => $isRetake,
            ]
        );
    }

    public function batchUpdateStudentGrades(array $enrollmentIds): int
    {
        $count = 0;

        foreach ($enrollmentIds as $enrollmentId) {
            $this->updateStudentGrade($enrollmentId);
            $count++;
        }

        return $count;
    }

    public function getGradePointTable(): array
    {
        return $this->gradePointTable;
    }

    public function getLetterGradeTable(): array
    {
        return $this->letterGradeTable;
    }

    public function isFailed(float $totalScore): bool
    {
        return $totalScore < 60;
    }

    public function calculateTranscript(int $studentId, ?string $semester = null): array
    {
        $query = $this->studentGradeModel
            ->with('enrollment.schedule.course')
            ->whereHas('enrollment', function ($q) use ($studentId) {
                $q->where('student_id', $studentId);
            });

        if ($semester) {
            $query->whereHas('enrollment.schedule', function ($q) use ($semester) {
                $q->where('semester', $semester);
            });
        }

        $studentGrades = $query->get();

        $courses = [];
        $totalGradePoints = 0.0;
        $totalCredits = 0.0;
        $passedCredits = 0.0;

        foreach ($studentGrades as $studentGrade) {
            $course = $studentGrade->enrollment->schedule->course;
            $credits = $course->credits;

            $courses[] = [
                'course_id' => $course->id,
                'course_code' => $course->code,
                'course_name' => $course->name,
                'credits' => $credits,
                'semester' => $studentGrade->enrollment->schedule->semester,
                'total_score' => $studentGrade->total_score,
                'grade_point' => $studentGrade->grade_point,
                'letter_grade' => $studentGrade->letter_grade,
                'is_retake' => $studentGrade->is_retake,
                'is_failed' => $this->isFailed($studentGrade->total_score),
            ];

            $totalGradePoints += $studentGrade->grade_point * $credits;
            $totalCredits += $credits;

            if (!$this->isFailed($studentGrade->total_score)) {
                $passedCredits += $credits;
            }
        }

        $overallGPA = $totalCredits > 0 ? $totalGradePoints / $totalCredits : 0.0;

        return [
            'student_id' => $studentId,
            'courses' => $courses,
            'total_credits' => $totalCredits,
            'passed_credits' => $passedCredits,
            'overall_gpa' => $overallGPA,
            'course_count' => count($courses),
        ];
    }

    public function calculateSemesterGPA(int $studentId, string $semester): float
    {
        $transcript = $this->calculateTranscript($studentId, $semester);

        return $transcript['overall_gpa'];
    }

    public function calculateCumulativeGPA(int $studentId): float
    {
        $transcript = $this->calculateTranscript($studentId);

        return $transcript['overall_gpa'];
    }
}