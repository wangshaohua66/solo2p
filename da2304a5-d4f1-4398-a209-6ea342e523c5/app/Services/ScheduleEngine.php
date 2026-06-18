<?php

namespace App\Services;

use App\Models\Classroom;
use App\Models\ClassroomOccupancy;
use App\Models\Course;
use App\Models\Schedule;
use App\Models\Teacher;
use App\Models\TeacherCoursePreference;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

class ScheduleEngine
{
    protected $semester;
    protected $lockedSchedules;
    protected $teacherAssignments = [];
    protected $classroomAssignments = [];
    protected $conflicts = [];

    public function __construct(
        protected Schedule $schedule,
        protected Teacher $teacher,
        protected Course $course,
        protected Classroom $classroom,
        protected TeacherCoursePreference $teacherCoursePreference,
        protected ClassroomOccupancy $classroomOccupancy
    ) {}

    public function generate(string $semester, array $lockedScheduleIds = []): array
    {
        $this->semester = $semester;
        $this->conflicts = [];

        $this->lockedSchedules = $this->schedule->newQuery()
            ->where('semester', $semester)
            ->whereIn('id', $lockedScheduleIds)
            ->with(['course', 'teacher', 'classroom'])
            ->get();

        $this->buildAssignmentCaches();

        $courses = $this->course->newQuery()
            ->where('status', 1)
            ->whereHas('schedules', function ($q) use ($semester) {
                $q->where('semester', $semester);
            })
            ->whereDoesntHave('schedules', function ($q) use ($semester) {
                $q->where('semester', $semester)->whereNotNull('teacher_id');
            })
            ->get();

        $courses = $courses->sortBy(function ($course) {
            $priorityMap = ['required' => 1, 'elective' => 2, 'general' => 3];
            return $priorityMap[$course->category] ?? 3;
        });

        $createdSchedules = new Collection();

        foreach ($courses as $course) {
            $teachers = $this->getAvailableTeachers($course->id, $semester);

            foreach ($teachers as $teacher) {
                $preferredSlots = $this->getPreferredSlots($teacher->id, $course->id, $semester);
                $slots = empty($preferredSlots) ? $this->generateDefaultSlots() : $preferredSlots;

                foreach ($slots as $slot) {
                    $duration = (int) ceil($course->hours / 50);
                    $endPeriod = $slot['period'] + $duration - 1;

                    if ($endPeriod > 12) {
                        continue;
                    }

                    if (!$this->checkTeacherConflict($teacher->id, $slot['day'], $slot['period'], $endPeriod)) {
                        $classrooms = $this->getAvailableClassrooms($course->id, $semester, $slot['day'], $slot['period'], $endPeriod);

                        foreach ($classrooms as $classroom) {
                            if (!$this->checkClassroomConflict($classroom->id, $slot['day'], $slot['period'], $endPeriod)) {
                                $schedule = $this->scheduleCourse($course, $teacher, $slot['day'], $slot['period'], $endPeriod, $classroom);
                                if ($schedule) {
                                    $createdSchedules->push($schedule);
                                    $this->updateCaches($schedule);
                                    break 3;
                                }
                            }
                        }
                    }
                }
            }
        }

        $this->runOptimization();

        $allSchedules = $this->schedule->newQuery()
            ->where('semester', $semester)
            ->with(['course', 'teacher', 'classroom'])
            ->get();

        $this->conflicts = $this->findAllConflicts();

        return [
            'schedules' => $allSchedules,
            'conflicts' => $this->conflicts,
            'stats' => [
                'total_courses' => $courses->count(),
                'scheduled_courses' => $createdSchedules->count(),
                'unscheduled_courses' => $courses->count() - $createdSchedules->count(),
                'total_conflicts' => count($this->conflicts),
                'generated_at' => Carbon::now()->toDateTimeString(),
            ],
        ];
    }

    public function checkTeacherConflict(int $teacherId, int $dayOfWeek, int $startPeriod, int $endPeriod, ?int $excludeScheduleId = null): bool
    {
        if (!isset($this->teacherAssignments[$teacherId][$dayOfWeek])) {
            return false;
        }

        foreach ($this->teacherAssignments[$teacherId][$dayOfWeek] as $assignment) {
            if ($excludeScheduleId !== null && $assignment['schedule_id'] === $excludeScheduleId) {
                continue;
            }

            if ($assignment['start'] <= $endPeriod && $assignment['end'] >= $startPeriod) {
                return true;
            }
        }

        return false;
    }

    public function checkClassroomConflict(int $classroomId, int $dayOfWeek, int $startPeriod, int $endPeriod, ?int $excludeScheduleId = null): bool
    {
        if (!isset($this->classroomAssignments[$classroomId][$dayOfWeek])) {
            return false;
        }

        foreach ($this->classroomAssignments[$classroomId][$dayOfWeek] as $assignment) {
            if ($excludeScheduleId !== null && $assignment['schedule_id'] === $excludeScheduleId) {
                continue;
            }

            if ($assignment['start'] <= $endPeriod && $assignment['end'] >= $startPeriod) {
                return true;
            }
        }

        return false;
    }

    public function findAllConflicts(): array
    {
        $allSchedules = $this->schedule->newQuery()
            ->where('semester', $this->semester)
            ->whereNotNull('teacher_id')
            ->whereNotNull('classroom_id')
            ->with(['course', 'teacher', 'classroom'])
            ->get();

        $conflicts = [];

        foreach ($allSchedules as $schedule) {
            foreach ($allSchedules as $other) {
                if ($schedule->id === $other->id) {
                    continue;
                }

                if ($schedule->teacher_id === $other->teacher_id &&
                    $schedule->day_of_week === $other->day_of_week &&
                    $schedule->start_period <= $other->end_period &&
                    $schedule->end_period >= $other->start_period) {
                    $conflicts[] = [
                        'type' => 'teacher_conflict',
                        'schedule_id' => $schedule->id,
                        'conflicting_schedule_id' => $other->id,
                        'teacher_id' => $schedule->teacher_id,
                        'teacher_name' => $schedule->teacher->name,
                        'course_name' => $schedule->course->name,
                        'day_of_week' => $schedule->day_of_week,
                        'start_period' => $schedule->start_period,
                        'end_period' => $schedule->end_period,
                    ];
                }

                if ($schedule->classroom_id === $other->classroom_id &&
                    $schedule->day_of_week === $other->day_of_week &&
                    $schedule->start_period <= $other->end_period &&
                    $schedule->end_period >= $other->start_period) {
                    $conflicts[] = [
                        'type' => 'classroom_conflict',
                        'schedule_id' => $schedule->id,
                        'conflicting_schedule_id' => $other->id,
                        'classroom_id' => $schedule->classroom_id,
                        'classroom_name' => $schedule->classroom->building . '-' . $schedule->classroom->room_number,
                        'course_name' => $schedule->course->name,
                        'day_of_week' => $schedule->day_of_week,
                        'start_period' => $schedule->start_period,
                        'end_period' => $schedule->end_period,
                    ];
                }
            }

            $courseHours = $schedule->course->hours;
            $periodsUsed = $schedule->end_period - $schedule->start_period + 1;
            $expectedPeriods = (int) ceil($courseHours / 50);

            if ($periodsUsed < $expectedPeriods) {
                $conflicts[] = [
                    'type' => 'consecutive_classes_broken',
                    'schedule_id' => $schedule->id,
                    'course_name' => $schedule->course->name,
                    'course_hours' => $courseHours,
                    'periods_used' => $periodsUsed,
                    'expected_periods' => $expectedPeriods,
                ];
            }

            $studentCount = $schedule->enrollments()->where('status', 'enrolled')->count();
            if ($studentCount > $schedule->classroom->capacity) {
                $conflicts[] = [
                    'type' => 'classroom_capacity_mismatch',
                    'schedule_id' => $schedule->id,
                    'course_name' => $schedule->course->name,
                    'classroom_name' => $schedule->classroom->building . '-' . $schedule->classroom->room_number,
                    'capacity' => $schedule->classroom->capacity,
                    'enrolled_students' => $studentCount,
                ];
            }
        }

        return $conflicts;
    }

    public function getAvailableTeachers(int $courseId, string $semester): Collection
    {
        $course = $this->course->newQuery()->findOrFail($courseId);

        $experiencedTeachers = $this->teacher->newQuery()
            ->whereHas('schedules', function ($q) use ($courseId, $semester) {
                $q->where('course_id', $courseId)->where('semester', '<', $semester);
            })
            ->select('teachers.*');

        $sameCollegeTeachers = $this->teacher->newQuery()
            ->where('college_id', $course->college_id)
            ->whereNotExists(function ($q) use ($courseId, $semester) {
                $q->select('*')
                    ->from('schedules')
                    ->whereColumn('schedules.teacher_id', 'teachers.id')
                    ->where('schedules.course_id', $courseId)
                    ->where('schedules.semester', '<', $semester);
            })
            ->select('teachers.*');

        return $experiencedTeachers->union($sameCollegeTeachers)->get();
    }

    public function getPreferredSlots(int $teacherId, int $courseId, string $semester): array
    {
        $preferences = $this->teacherCoursePreference->newQuery()
            ->where('teacher_id', $teacherId)
            ->where('course_id', $courseId)
            ->where('semester', $semester)
            ->orderBy('priority', 'asc')
            ->get();

        $slots = [];
        foreach ($preferences as $pref) {
            $slots[] = [
                'day' => $pref->preferred_day,
                'period' => $pref->preferred_period,
                'priority' => $pref->priority,
            ];
        }

        return $slots;
    }

    public function getAvailableClassrooms(int $courseId, string $semester, int $dayOfWeek, int $startPeriod, int $endPeriod): Collection
    {
        $course = $this->course->newQuery()->findOrFail($courseId);

        $query = $this->classroom->newQuery()
            ->where('status', 1);

        if (!empty($course->type)) {
            $query->where('type', $course->type);
        }

        $classrooms = $query->get();

        return $classrooms->filter(function ($classroom) use ($dayOfWeek, $startPeriod, $endPeriod) {
            return !$this->checkClassroomConflict($classroom->id, $dayOfWeek, $startPeriod, $endPeriod);
        })->sortByDesc('capacity');
    }

    public function buildAssignmentCaches(): void
    {
        $this->teacherAssignments = [];
        $this->classroomAssignments = [];

        foreach ($this->lockedSchedules as $schedule) {
            if (!isset($this->teacherAssignments[$schedule->teacher_id])) {
                $this->teacherAssignments[$schedule->teacher_id] = [];
            }
            if (!isset($this->teacherAssignments[$schedule->teacher_id][$schedule->day_of_week])) {
                $this->teacherAssignments[$schedule->teacher_id][$schedule->day_of_week] = [];
            }
            $this->teacherAssignments[$schedule->teacher_id][$schedule->day_of_week][] = [
                'schedule_id' => $schedule->id,
                'start' => $schedule->start_period,
                'end' => $schedule->end_period,
            ];

            if (!isset($this->classroomAssignments[$schedule->classroom_id])) {
                $this->classroomAssignments[$schedule->classroom_id] = [];
            }
            if (!isset($this->classroomAssignments[$schedule->classroom_id][$schedule->day_of_week])) {
                $this->classroomAssignments[$schedule->classroom_id][$schedule->day_of_week] = [];
            }
            $this->classroomAssignments[$schedule->classroom_id][$schedule->day_of_week][] = [
                'schedule_id' => $schedule->id,
                'start' => $schedule->start_period,
                'end' => $schedule->end_period,
            ];
        }
    }

    public function scheduleCourse(Course $course, Teacher $teacher, int $dayOfWeek, int $startPeriod, int $endPeriod, Classroom $classroom): ?Schedule
    {
        return $this->schedule->newQuery()->create([
            'course_id' => $course->id,
            'teacher_id' => $teacher->id,
            'classroom_id' => $classroom->id,
            'semester' => $this->semester,
            'day_of_week' => $dayOfWeek,
            'start_period' => $startPeriod,
            'end_period' => $endPeriod,
            'weeks' => '1-16',
            'is_locked' => false,
            'status' => 'scheduled',
        ]);
    }

    public function runOptimization(): void
    {
        $unlockedSchedules = $this->schedule->newQuery()
            ->where('semester', $this->semester)
            ->where('is_locked', false)
            ->with(['course', 'teacher'])
            ->get();

        foreach ($unlockedSchedules as $schedule) {
            $preferredSlots = $this->getPreferredSlots($schedule->teacher_id, $schedule->course_id, $this->semester);

            foreach ($preferredSlots as $slot) {
                $duration = $schedule->end_period - $schedule->start_period + 1;
                $endPeriod = $slot['period'] + $duration - 1;

                if ($endPeriod > 12) {
                    continue;
                }

                if ($schedule->day_of_week === $slot['day'] && $schedule->start_period === $slot['period']) {
                    break;
                }

                if (!$this->checkTeacherConflict($schedule->teacher_id, $slot['day'], $slot['period'], $endPeriod, $schedule->id)) {
                    $classrooms = $this->getAvailableClassrooms($schedule->course_id, $this->semester, $slot['day'], $slot['period'], $endPeriod);

                    foreach ($classrooms as $classroom) {
                        if (!$this->checkClassroomConflict($classroom->id, $slot['day'], $slot['period'], $endPeriod, $schedule->id)) {
                            $this->removeFromCaches($schedule);
                            $schedule->update([
                                'day_of_week' => $slot['day'],
                                'start_period' => $slot['period'],
                                'end_period' => $endPeriod,
                                'classroom_id' => $classroom->id,
                            ]);
                            $this->updateCaches($schedule);
                            break 2;
                        }
                    }
                }
            }
        }
    }

    protected function generateDefaultSlots(): array
    {
        $slots = [];
        for ($day = 1; $day <= 5; $day++) {
            for ($period = 1; $period <= 12; $period++) {
                $slots[] = ['day' => $day, 'period' => $period];
            }
        }
        return $slots;
    }

    protected function updateCaches(Schedule $schedule): void
    {
        if (!isset($this->teacherAssignments[$schedule->teacher_id])) {
            $this->teacherAssignments[$schedule->teacher_id] = [];
        }
        if (!isset($this->teacherAssignments[$schedule->teacher_id][$schedule->day_of_week])) {
            $this->teacherAssignments[$schedule->teacher_id][$schedule->day_of_week] = [];
        }
        $this->teacherAssignments[$schedule->teacher_id][$schedule->day_of_week][] = [
            'schedule_id' => $schedule->id,
            'start' => $schedule->start_period,
            'end' => $schedule->end_period,
        ];

        if (!isset($this->classroomAssignments[$schedule->classroom_id])) {
            $this->classroomAssignments[$schedule->classroom_id] = [];
        }
        if (!isset($this->classroomAssignments[$schedule->classroom_id][$schedule->day_of_week])) {
            $this->classroomAssignments[$schedule->classroom_id][$schedule->day_of_week] = [];
        }
        $this->classroomAssignments[$schedule->classroom_id][$schedule->day_of_week][] = [
            'schedule_id' => $schedule->id,
            'start' => $schedule->start_period,
            'end' => $schedule->end_period,
        ];
    }

    protected function removeFromCaches(Schedule $schedule): void
    {
        if (isset($this->teacherAssignments[$schedule->teacher_id][$schedule->day_of_week])) {
            $this->teacherAssignments[$schedule->teacher_id][$schedule->day_of_week] = array_filter(
                $this->teacherAssignments[$schedule->teacher_id][$schedule->day_of_week],
                function ($a) use ($schedule) {
                    return $a['schedule_id'] !== $schedule->id;
                }
            );
        }

        if (isset($this->classroomAssignments[$schedule->classroom_id][$schedule->day_of_week])) {
            $this->classroomAssignments[$schedule->classroom_id][$schedule->day_of_week] = array_filter(
                $this->classroomAssignments[$schedule->classroom_id][$schedule->day_of_week],
                function ($a) use ($schedule) {
                    return $a['schedule_id'] !== $schedule->id;
                }
            );
        }
    }
}