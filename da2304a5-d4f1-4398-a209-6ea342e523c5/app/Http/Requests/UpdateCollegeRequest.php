<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCollegeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'sometimes|string|max:100',
            'code' => 'sometimes|string|max:20',
            'dean_name' => 'nullable|string|max:50',
            'status' => 'integer|in:0,1',
        ];
    }
}
