<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MatchAnalysisRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'deck_id' => ['nullable', 'integer', 'exists:decks,id'],
            'format' => ['nullable', 'string', 'in:standard,pioneer,modern,legacy,vintage,commander,pauper,casual'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'interval' => ['nullable', 'string', 'in:day,week,month,year'],
            'opponent_archetype' => ['nullable', 'string', 'max:255'],
        ];
    }
}
