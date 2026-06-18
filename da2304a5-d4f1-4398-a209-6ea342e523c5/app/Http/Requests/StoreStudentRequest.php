<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'major_id' => 'required|integer|exists:majors,id',
            'name' => 'required|string|max:50',
            'student_no' => 'required|string|max:20',
            'gender' => 'required|in:male,female',
            'enrollment_year' => 'required|integer|min:2000|max:2099',
            'class_name' => 'nullable|string|max:20',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
        ];
    }
}
