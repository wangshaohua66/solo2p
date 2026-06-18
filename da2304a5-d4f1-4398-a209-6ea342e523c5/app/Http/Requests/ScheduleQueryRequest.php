<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ScheduleQueryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'semester' => 'required|string|max:20',
            'week' => 'nullable|integer|min:1|max:30',
            'day_of_week' => 'nullable|integer|min:1|max:7',
            'student_id' => 'nullable|integer|exists:students,id',
            'teacher_id' => 'nullable|integer|exists:teachers,id',
            'classroom_id' => 'nullable|integer|exists:classrooms,id',
        ];
    }
}
