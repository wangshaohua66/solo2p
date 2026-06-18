<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreGradeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'enrollment_id' => 'required|integer|exists:enrollments,id',
            'component_id' => 'required|integer|exists:grade_components,id',
            'score' => 'nullable|numeric|min:0|max:100',
            'is_absent' => 'boolean',
        ];
    }
}
