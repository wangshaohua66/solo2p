<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ListingCreateRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'energy_type' => 'required|in:solar,wind',
            'quantity' => 'required|integer|min:1',
            'unit_price' => 'required|numeric|min:0.01',
            'expires_at' => 'nullable|date|after:today',
            'remark' => 'nullable|string|max:500',
        ];
    }
}
