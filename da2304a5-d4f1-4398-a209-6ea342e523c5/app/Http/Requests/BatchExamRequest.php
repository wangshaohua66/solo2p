<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BatchExamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'exams' => 'required|array|min:1',
            'exams.*.schedule_id' => 'required|integer|exists:schedules,id',
            'exams.*.exam_type' => 'required|in:midterm,final,makeup',
            'exams.*.exam_date' => 'required|date',
            'exams.*.start_time' => 'required|date_format:H:i',
            'exams.*.end_time' => 'required|date_format:H:i|after:start_time',
            'exams.*.classroom_id' => 'nullable|integer|exists:classrooms,id',
        ];
    }
}
