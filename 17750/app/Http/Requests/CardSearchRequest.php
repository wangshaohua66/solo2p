<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CardSearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['nullable', 'string', 'min:1', 'max:255'],
            'oracle_text' => ['nullable', 'string', 'min:1', 'max:500'],
            'colors' => ['nullable', 'array'],
            'colors.*' => ['string', 'in:W,U,B,R,G,C'],
            'color_identity' => ['nullable', 'array'],
            'color_identity.*' => ['string', 'in:W,U,B,R,G,C'],
            'type' => ['nullable', 'string', 'max:100'],
            'cmc' => ['nullable', 'integer', 'min:0', 'max:20'],
            'cmc_operator' => ['nullable', 'string', 'in:=,>,<,>=,<=,!='],
            'rarity' => ['nullable', 'string', 'in:common,uncommon,rare,mythic,special'],
            'set' => ['nullable', 'string', 'size:3'],
            'format' => ['nullable', 'string', 'in:standard,pioneer,modern,legacy,vintage,commander,pauper,casual'],
            'keyword' => ['nullable', 'string', 'max:100'],
            'artist' => ['nullable', 'string', 'max:255'],
            'sort_by' => ['nullable', 'string', 'in:name,cmc,rarity,set_code,released_at,edhrec_rank,price_usd'],
            'sort_dir' => ['nullable', 'string', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
