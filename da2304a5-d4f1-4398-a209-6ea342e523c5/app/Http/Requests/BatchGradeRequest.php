<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BatchGradeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'grades' => 'required|array|min:1',
            'grades.*.enrollment_id' => 'required|integer|exists:enrollments,id',
            'grades.*.component_id' => 'required|integer|exists:grade_components,id',
            'grades.*.score' => 'nullable|numeric|min:0|max:100',
            'grades.*.is_absent' => 'boolean',
        ];
    }
}
