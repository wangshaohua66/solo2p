<?php

namespace App\Repositories;

use App\Models\Enrollment;
use App\Models\Student;
use App\Models\StudentStatusChange;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class StudentStatusChangeRepository
{
    public function __construct(
        protected StudentStatusChange $studentStatusChange
    ) {}

    public function getChangesByStudent(int $studentId): Collection
    {
        return $this->studentStatusChange->newQuery()
            ->where('student_id', $studentId)
            ->with(['fromMajor', 'toMajor'])
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function getPendingChanges(): LengthAwarePaginator
    {
        return $this->studentStatusChange->newQuery()
            ->where('status', 'pending')
            ->with(['student', 'fromMajor', 'toMajor'])
            ->orderBy('created_at', 'desc')
            ->paginate();
    }

    public function create(array $data): StudentStatusChange
    {
        return $this->studentStatusChange->newQuery()->create($data);
    }

    public function approve(int $id, string $approvedBy, ?string $notes = null): StudentStatusChange
    {
        $change = $this->studentStatusChange->newQuery()->findOrFail($id);
        $change->update([
            'status' => 'approved',
            'approved_by' => $approvedBy,
            'approved_at' => now(),
            'notes' => $notes ?? $change->notes,
        ]);
        return $change->fresh();
    }

    public function reject(int $id, string $approvedBy, ?string $notes = null): StudentStatusChange
    {
        $change = $this->studentStatusChange->newQuery()->findOrFail($id);
        $change->update([
            'status' => 'rejected',
            'approved_by' => $approvedBy,
            'approved_at' => now(),
            'notes' => $notes ?? $change->notes,
        ]);
        return $change->fresh();
    }

    public function processSuspension(int $studentId): void
    {
        DB::transaction(function () use ($studentId) {
            Student::query()->where('id', $studentId)->update(['status' => 'suspended']);

            Enrollment::query()
                ->where('student_id', $studentId)
                ->where('status', 'enrolled')
                ->update([
                    'status' => 'dropped',
                    'dropped_at' => now(),
                ]);
        });
    }

    public function processResumption(int $studentId): void
    {
        Student::query()->where('id', $studentId)->update(['status' => 'active']);
    }

    public function processWithdrawal(int $studentId): void
    {
        DB::transaction(function () use ($studentId) {
            Student::query()->where('id', $studentId)->update(['status' => 'withdrawn']);

            Enrollment::query()
                ->where('student_id', $studentId)
                ->whereIn('status', ['enrolled', 'waitlisted'])
                ->update([
                    'status' => 'dropped',
                    'dropped_at' => now(),
                ]);
        });
    }

    public function processTransfer(int $studentId, int $toMajorId): void
    {
        Student::query()->where('id', $studentId)->update(['major_id' => $toMajorId]);
    }
}
