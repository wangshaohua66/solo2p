<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'major_id' => 'sometimes|integer|exists:majors,id',
            'name' => 'sometimes|string|max:50',
            'student_no' => 'sometimes|string|max:20',
            'gender' => 'sometimes|in:male,female',
            'enrollment_year' => 'sometimes|integer|min:2000|max:2099',
            'class_name' => 'nullable|string|max:20',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'status' => 'sometimes|in:active,suspended,withdrawn,graduated',
        ];
    }
}
