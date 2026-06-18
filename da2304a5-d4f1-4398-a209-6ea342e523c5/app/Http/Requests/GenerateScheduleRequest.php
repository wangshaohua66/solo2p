<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GenerateScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'semester' => 'required|string|max:20|regex:/^\d{4}-[12]$/',
            'locked_schedule_ids' => 'nullable|array',
            'locked_schedule_ids.*' => 'integer|exists:schedules,id',
        ];
    }
}
