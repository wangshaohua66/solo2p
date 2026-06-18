<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEvaluationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'schedule_id' => 'required|integer|exists:schedules,id',
            'teaching_score' => 'required|integer|min:1|max:10',
            'attitude_score' => 'required|integer|min:1|max:10',
            'content_score' => 'required|integer|min:1|max:10',
            'comment' => 'nullable|string|max:500',
            'is_anonymous' => 'boolean',
        ];
    }
}
