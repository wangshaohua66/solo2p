<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'course_id' => 'required|integer|exists:courses,id',
            'teacher_id' => 'required|integer|exists:teachers,id',
            'classroom_id' => 'required|integer|exists:classrooms,id',
            'semester' => 'required|string|max:20|regex:/^\d{4}-[12]$/',
            'day_of_week' => 'required|integer|min:1|max:7',
            'start_period' => 'required|integer|min:1|max:12',
            'end_period' => 'required|integer|min:1|max:12|gt:start_period',
            'weeks' => 'required|string|max:50',
            'is_locked' => 'boolean',
        ];
    }
}
