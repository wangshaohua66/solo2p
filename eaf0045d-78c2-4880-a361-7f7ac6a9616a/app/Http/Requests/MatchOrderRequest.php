<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MatchOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'energy_type' => 'required|in:solar,wind',
            'quantity' => 'required|integer|min:1',
            'max_price' => 'nullable|numeric|min:0',
        ];
    }
}
