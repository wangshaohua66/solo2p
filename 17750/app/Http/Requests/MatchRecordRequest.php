<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MatchRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'deck_id' => ['nullable', 'integer', 'exists:decks,id'],
            'opponent_archetype' => ['nullable', 'string', 'max:255'],
            'format' => ['nullable', 'string', 'in:standard,pioneer,modern,legacy,vintage,commander,pauper,casual'],
            'on_play' => ['nullable', 'boolean'],
            'is_winner' => ['required', 'boolean'],
            'game_wins' => ['nullable', 'integer', 'min:0', 'max:10'],
            'game_losses' => ['nullable', 'integer', 'min:0', 'max:10'],
            'turn_count' => ['nullable', 'integer', 'min:1', 'max:200'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'key_cards' => ['nullable', 'array'],
            'key_cards.*' => ['string', 'max:255'],
            'mulligan_count' => ['nullable', 'integer', 'min:0', 'max:7'],
            'played_at' => ['nullable', 'date'],
        ];
    }
}
