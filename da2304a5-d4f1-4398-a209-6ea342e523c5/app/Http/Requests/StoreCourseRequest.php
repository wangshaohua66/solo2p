<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'college_id' => 'required|integer|exists:colleges,id',
            'major_id' => 'nullable|integer|exists:majors,id',
            'code' => 'required|string|max:20',
            'name' => 'required|string|max:100',
            'credits' => 'required|numeric|min:0.5|max:10',
            'hours' => 'required|integer|min:8|max:200',
            'type' => 'required|in:required,elective,general',
            'category' => 'nullable|string|max:50',
            'description' => 'nullable|string',
        ];
    }
}
