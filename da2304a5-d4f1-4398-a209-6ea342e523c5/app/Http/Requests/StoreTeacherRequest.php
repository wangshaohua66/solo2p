<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTeacherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'college_id' => 'required|integer|exists:colleges,id',
            'name' => 'required|string|max:50',
            'employee_no' => 'required|string|max:20',
            'gender' => 'required|in:male,female',
            'title' => 'required|in:assistant,lecturer,associate_professor,professor',
            'phone' => 'nullable|string|max:20',
            'email' => 'required|email|max:100',
        ];
    }
}
