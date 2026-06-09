<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CollectionItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'card_id' => ['required', 'integer', 'exists:cards,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'language' => ['nullable', 'string', 'max:10'],
            'condition' => ['nullable', 'string', 'in:NM,SP,MP,HP,DMG'],
            'is_foil' => ['nullable', 'boolean'],
            'is_signed' => ['nullable', 'boolean'],
            'is_altered' => ['nullable', 'boolean'],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'purchase_source' => ['nullable', 'string', 'max:255'],
            'purchase_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
