<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreExamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'schedule_id' => 'required|integer|exists:schedules,id',
            'exam_type' => 'required|in:midterm,final,makeup',
            'exam_date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'classroom_id' => 'nullable|integer|exists:classrooms,id',
            'notes' => 'nullable|string',
        ];
    }
}
