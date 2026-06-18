<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'course_id' => 'sometimes|integer|exists:courses,id',
            'teacher_id' => 'sometimes|integer|exists:teachers,id',
            'classroom_id' => 'sometimes|integer|exists:classrooms,id',
            'semester' => 'sometimes|string|max:20|regex:/^\d{4}-[12]$/',
            'day_of_week' => 'sometimes|integer|min:1|max:7',
            'start_period' => 'sometimes|integer|min:1|max:12',
            'end_period' => 'sometimes|integer|min:1|max:12|gt:start_period',
            'weeks' => 'sometimes|string|max:50',
            'is_locked' => 'boolean',
        ];
    }
}
