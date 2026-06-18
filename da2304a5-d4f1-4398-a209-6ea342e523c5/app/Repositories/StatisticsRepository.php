<?php

namespace App\Repositories;

use Illuminate\Support\Facades\DB;

class StatisticsRepository
{
    public function getEnrollmentStats(?int $collegeId = null, ?int $majorId = null, ?string $semester = null): array
    {
        $query = DB::table('enrollments')
            ->join('schedules', 'enrollments.schedule_id', '=', 'schedules.id')
            ->join('courses', 'schedules.course_id', '=', 'courses.id')
            ->where('enrollments.status', 'enrolled');

        if ($collegeId !== null) {
            $query->where('courses.college_id', $collegeId);
        }

        if ($majorId !== null) {
            $query->where('courses.major_id', $majorId);
        }

        if ($semester !== null) {
            $query->where('schedules.semester', $semester);
        }

        return $query
            ->select('courses.type as course_type', DB::raw('COUNT(*) as enrollment_count'))
            ->groupBy('courses.type')
            ->pluck('enrollment_count', 'course_type')
            ->toArray();
    }

    public function getCreditDistribution(?int $collegeId = null, ?string $grade = null): array
    {
        $query = DB::table('student_grades')
            ->join('enrollments', 'student_grades.enrollment_id', '=', 'enrollments.id')
            ->join('students', 'enrollments.student_id', '=', 'students.id')
            ->join('majors', 'students.major_id', '=', 'majors.id')
            ->join('schedules', 'enrollments.schedule_id', '=', 'schedules.id')
            ->join('courses', 'schedules.course_id', '=', 'courses.id')
            ->where('enrollments.status', 'enrolled');

        if ($collegeId !== null) {
            $query->where('majors.college_id', $collegeId);
        }

        if ($grade !== null) {
            $query->where('student_grades.letter_grade', $grade);
        }

        return $query
            ->select('students.id as student_id', DB::raw('SUM(courses.credits) as total_credits'))
            ->groupBy('students.id')
            ->pluck('total_credits', 'student_id')
            ->toArray();
    }

    public function getGradeDistribution(?int $collegeId = null, ?int $majorId = null, ?string $semester = null): array
    {
        $query = DB::table('student_grades')
            ->join('enrollments', 'student_grades.enrollment_id', '=', 'enrollments.id')
            ->join('schedules', 'enrollments.schedule_id', '=', 'schedules.id')
            ->join('courses', 'schedules.course_id', '=', 'courses.id');

        if ($collegeId !== null) {
            $query->where('courses.college_id', $collegeId);
        }

        if ($majorId !== null) {
            $query->where('courses.major_id', $majorId);
        }

        if ($semester !== null) {
            $query->where('schedules.semester', $semester);
        }

        $distribution = $query
            ->select('student_grades.letter_grade', DB::raw('COUNT(*) as count'))
            ->groupBy('student_grades.letter_grade')
            ->pluck('count', 'letter_grade')
            ->toArray();

        $avgScore = $query->average('student_grades.total_score');

        return [
            'distribution' => $distribution,
            'average_score' => $avgScore ? round($avgScore, 2) : null,
        ];
    }

    public function getTeacherWorkload(?int $collegeId = null, ?string $semester = null): array
    {
        $query = DB::table('schedules')
            ->join('teachers', 'schedules.teacher_id', '=', 'teachers.id')
            ->join('courses', 'schedules.course_id', '=', 'courses.id');

        if ($collegeId !== null) {
            $query->where('teachers.college_id', $collegeId);
        }

        if ($semester !== null) {
            $query->where('schedules.semester', $semester);
        }

        return $query
            ->select(
                'teachers.id as teacher_id',
                'teachers.name as teacher_name',
                DB::raw('SUM(schedules.end_period - schedules.start_period + 1) as weekly_hours'),
                DB::raw('COUNT(DISTINCT schedules.course_id) as course_count')
            )
            ->groupBy('teachers.id', 'teachers.name')
            ->get()
            ->toArray();
    }
}
