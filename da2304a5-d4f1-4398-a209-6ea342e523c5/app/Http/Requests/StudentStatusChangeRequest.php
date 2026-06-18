<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StudentStatusChangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'student_id' => 'required|integer|exists:students,id',
            'type' => 'required|in:suspend,resume,withdraw,transfer',
            'reason' => 'required|string|max:500',
            'to_major_id' => 'required_if:type,transfer|integer|exists:majors,id',
            'effective_date' => 'required|date',
        ];
    }
}
