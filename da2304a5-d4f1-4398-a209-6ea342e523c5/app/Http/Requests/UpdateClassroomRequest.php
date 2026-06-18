<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateClassroomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'building' => 'sometimes|string|max:50',
            'room_number' => 'sometimes|string|max:20',
            'capacity' => 'sometimes|integer|min:1',
            'type' => 'sometimes|in:lecture,lab,computer,multimedia',
            'status' => 'integer|in:0,1',
        ];
    }
}
