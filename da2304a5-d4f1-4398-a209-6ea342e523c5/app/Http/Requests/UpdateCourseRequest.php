<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'college_id' => 'sometimes|integer|exists:colleges,id',
            'major_id' => 'nullable|integer|exists:majors,id',
            'code' => 'sometimes|string|max:20',
            'name' => 'sometimes|string|max:100',
            'credits' => 'sometimes|numeric|min:0.5|max:10',
            'hours' => 'sometimes|integer|min:8|max:200',
            'type' => 'sometimes|in:required,elective,general',
            'category' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'status' => 'integer|in:0,1',
        ];
    }
}
