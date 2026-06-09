<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MetaSnapshotRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'format' => ['required', 'string', 'in:standard,pioneer,modern,legacy,vintage,commander,pauper,casual'],
            'source' => ['nullable', 'string', 'max:255'],
            'snapshot_date' => ['required', 'date'],
            'total_decks' => ['nullable', 'integer', 'min:0'],
            'meta_data' => ['required', 'array'],
            'archetypes' => ['nullable', 'array'],
            'archetypes.*.name' => ['required_with:archetypes', 'string', 'max:255'],
            'archetypes.*.percentage' => ['required_with:archetypes', 'numeric', 'min:0', 'max:100'],
            'archetypes.*.win_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'archetypes.*.sample_size' => ['nullable', 'integer', 'min:0'],
            'archetypes.*.color_identity' => ['nullable', 'array'],
            'archetypes.*.color_identity.*' => ['string', 'in:W,U,B,R,G,C'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
