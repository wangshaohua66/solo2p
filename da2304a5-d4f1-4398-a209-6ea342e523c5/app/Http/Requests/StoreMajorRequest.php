<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMajorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'college_id' => 'required|integer|exists:colleges,id',
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:20',
            'degree_level' => 'required|in:bachelor,master,phd',
            'duration_years' => 'required|integer|min:2|max:6',
        ];
    }
}
