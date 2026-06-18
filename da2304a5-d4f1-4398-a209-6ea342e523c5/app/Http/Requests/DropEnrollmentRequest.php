<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DropEnrollmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'enrollment_id' => 'required|integer|exists:enrollments,id',
        ];
    }
}
