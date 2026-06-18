<?php

namespace App\Services;

use App\Models\Classroom;
use App\Models\Exam;
use App\Models\ExamProctor;
use App\Models\Schedule;
use App\Models\Teacher;
use App\Repositories\ExamRepository;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class ExamService
{
    protected $semester;

    public function __construct(
        protected ExamRepository $examRepository,
        protected Classroom $classroom,
        protected Teacher $teacher,
        protected Schedule $schedule
    ) {}

    public function batchScheduleExams(array $scheduleIds, string $examType, array $examDates): array
    {
        $exams = new Collection();
        $warnings = [];

        foreach ($scheduleIds as $scheduleId) {
            $schedule = $this->schedule->newQuery()->find($scheduleId);
            if (!$schedule) {
                $warnings[] = "Schedule $scheduleId not found";
                continue;
            }

            $randomDate = $examDates[array_rand($examDates)];
            $startTime = '09:00';
            $endTime = '11:00';

            try {
                $exam = $this->scheduleExam($scheduleId, $examType, $randomDate, $startTime, $endTime);
                $exams->push($exam);
            } catch (\Exception $e) {
                $warnings[] = "Failed to schedule exam for schedule $scheduleId: " . $e->getMessage();
            }
        }

        return ['exams' => $exams, 'warnings' => $warnings];
    }

    public function scheduleExam(int $scheduleId, string $examType, string $examDate, string $startTime, string $endTime): Exam
    {
        $schedule = $this->schedule->newQuery()->findOrFail($scheduleId);

        $classroom = $this->autoAssignClassroom($scheduleId, $examDate, $startTime, $endTime);

        $exam = $this->examRepository->bulkCreateExams([[
            'schedule_id' => $scheduleId,
            'exam_type' => $examType,
            'exam_date' => $examDate,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'classroom_id' => $classroom?->id,
            'status' => 'planned',
        ]])->first();

        $this->autoAssignProctors($exam->id, $scheduleId);

        return $exam;
    }

    public function autoAssignClassroom(int $scheduleId, string $examDate, string $startTime, string $endTime): ?Classroom
    {
        $schedule = $this->schedule->newQuery()->find($scheduleId);
        if (!$schedule) {
            return null;
        }

        $enrollmentCount = $schedule->enrollments()->where('status', 'enrolled')->count();

        return $this->classroom->newQuery()
            ->where('status', 1)
            ->where('capacity', '>=', $enrollmentCount)
            ->get()
            ->first(function ($classroom) use ($examDate, $startTime, $endTime) {
                return !$this->checkClassroomAvailability($classroom->id, $examDate, $startTime, $endTime);
            });
    }

    public function autoAssignProctors(int $examId, int $scheduleId): void
    {
        $schedule = $this->schedule->newQuery()->find($scheduleId);
        if (!$schedule) {
            return;
        }

        $exam = Exam::query()->find($examId);
        if (!$exam) {
            return;
        }

        $courseTeacherId = $schedule->teacher_id;

        $availableProctors = $this->getAvailableProctors($scheduleId, $exam->exam_date, $exam->start_time, $exam->end_time, 3);

        $chiefProctors = $availableProctors->filter(function ($teacher) {
            return in_array($teacher->title, ['associate_professor', 'professor']);
        });

        $regularProctors = $availableProctors->filter(function ($teacher) use ($courseTeacherId) {
            return $teacher->id !== $courseTeacherId && !in_array($teacher->title, ['associate_professor', 'professor']);
        });

        DB::beginTransaction();

        ExamProctor::query()->where('exam_id', $examId)->delete();

        if (!$chiefProctors->isEmpty()) {
            $chief = $chiefProctors->first();
            ExamProctor::query()->create([
                'exam_id' => $examId,
                'teacher_id' => $chief->id,
                'role' => 'chief',
            ]);
            $availableProctors = $availableProctors->reject(function ($t) use ($chief) {
                return $t->id === $chief->id;
            });
        }

        $regularCount = rand(1, 2);
        $selectedRegular = $availableProctors->take($regularCount);

        foreach ($selectedRegular as $proctor) {
            ExamProctor::query()->create([
                'exam_id' => $examId,
                'teacher_id' => $proctor->id,
                'role' => 'proctor',
            ]);
        }

        DB::commit();
    }

    public function checkClassroomAvailability(int $classroomId, string $examDate, string $startTime, string $endTime, ?int $excludeExamId = null): bool
    {
        $query = Exam::query()
            ->where('classroom_id', $classroomId)
            ->whereDate('exam_date', $examDate)
            ->whereTime('start_time', '<', $endTime)
            ->whereTime('end_time', '>', $startTime);

        if ($excludeExamId !== null) {
            $query->where('id', '!=', $excludeExamId);
        }

