<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreGradeComponentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'course_id' => 'required|integer|exists:courses,id',
            'name' => 'required|string|max:50',
            'weight' => 'required|numeric|min:0.01|max:100',
            'sort_order' => 'required|integer|min:0',
        ];
    }
}
