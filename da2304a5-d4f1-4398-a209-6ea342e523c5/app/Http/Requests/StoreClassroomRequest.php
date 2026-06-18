<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreClassroomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'building' => 'required|string|max:50',
            'room_number' => 'required|string|max:20',
            'capacity' => 'required|integer|min:1',
            'type' => 'required|in:lecture,lab,computer,multimedia',
            'status' => 'integer|in:0,1',
        ];
    }
}
