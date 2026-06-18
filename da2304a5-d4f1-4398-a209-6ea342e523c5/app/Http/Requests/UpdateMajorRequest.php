<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMajorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'college_id' => 'sometimes|integer|exists:colleges,id',
            'name' => 'sometimes|string|max:100',
            'code' => 'sometimes|string|max:20',
            'degree_level' => 'sometimes|in:bachelor,master,phd',
            'duration_years' => 'sometimes|integer|min:2|max:6',
        ];
    }
}
