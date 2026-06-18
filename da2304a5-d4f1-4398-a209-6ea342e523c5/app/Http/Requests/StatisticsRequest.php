<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StatisticsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => 'required|in:enrollment,credit,grade,workload',
            'college_id' => 'nullable|integer|exists:colleges,id',
            'major_id' => 'nullable|integer|exists:majors,id',
            'grade' => 'nullable|string',
            'semester' => 'nullable|string|max:20',
        ];
    }
}
