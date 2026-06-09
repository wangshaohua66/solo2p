<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeckRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'format' => ['required', 'string', 'in:standard,pioneer,modern,legacy,vintage,commander,pauper,casual'],
            'description' => ['nullable', 'string', 'max:2000'],
            'archetype' => ['nullable', 'string', 'max:100'],
            'colors' => ['nullable', 'array'],
            'colors.*' => ['string', 'in:W,U,B,R,G,C'],
            'cards' => ['nullable', 'array'],
            'cards.*.card_id' => ['required_with:cards', 'integer', 'exists:cards,id'],
            'cards.*.quantity' => ['required_with:cards', 'integer', 'min:1', 'max:999'],
            'cards.*.is_sideboard' => ['nullable', 'boolean'],
        ];
    }
}
