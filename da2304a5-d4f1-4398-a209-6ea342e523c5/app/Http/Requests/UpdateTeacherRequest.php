<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTeacherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'college_id' => 'sometimes|integer|exists:colleges,id',
            'name' => 'sometimes|string|max:50',
            'employee_no' => 'sometimes|string|max:20',
            'gender' => 'sometimes|in:male,female',
            'title' => 'sometimes|in:assistant,lecturer,associate_professor,professor',
            'phone' => 'nullable|string|max:20',
            'email' => 'sometimes|email|max:100',
            'status' => 'sometimes|in:active,inactive,retired',
        ];
    }
}
