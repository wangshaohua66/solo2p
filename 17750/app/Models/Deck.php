<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

/**
 * @OA\Schema(
 *     schema="Deck",
 *     type="object",
 *     title="Deck",
 *     description="Deck",
 *     @OA\Property(property="id", type="integer", example=1),
 *     @OA\Property(property="name", type="string", example="Rakdos Midrange"),
 *     @OA\Property(property="format", type="string", example="standard"),
 *     @OA\Property(property="archetype", type="string", example="Midrange"),
 *     @OA\Property(property="is_legal", type="boolean", example=true),
 *     @OA\Property(property="colors", type="array", @OA\Items(type="string"))
 * )
 */
class Deck extends Model
{
    use HasFactory;

    const FORMATS = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander', 'pauper', 'casual'];

    protected $fillable = [
        'name', 'format', 'description', 'archetype', 'colors',
        'is_legal', 'validation_errors',
    ];

    protected $casts = [
        'colors' => 'array',
        'is_legal' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function deckCards(): HasMany
    {
        return $this->hasMany(DeckCard::class);
    }

    public function mainboard(): HasMany
    {
        return $this->deckCards()->where('is_sideboard', false);
    }

    public function sideboard(): HasMany
    {
        return $this->deckCards()->where('is_sideboard', true);
    }

    public function cards(): HasManyThrough
    {
        return $this->hasManyThrough(Card::class, DeckCard::class);
    }

    public function matchRecords(): HasMany
    {
        return $this->hasMany(MatchRecord::class);
    }

    public function getMainboardCountAttribute(): int
    {
        return $this->mainboard()->sum('quantity');
    }

    public function getSideboardCountAttribute(): int
    {
        return $this->sideboard()->sum('quantity');
    }

    public function getTotalCardsAttribute(): int
    {
        return $this->deckCards()->sum('quantity');
    }

    public function getColorIdentityAttribute(): array
    {
        $colors = collect();
        foreach ($this->mainboard as $deckCard) {
            if ($deckCard->card?->color_identity) {
                $colors = $colors->merge($deckCard->card->color_identity);
            }
        }
        return $colors->unique()->sort()->values()->all();
    }

    public function scopeByFormat($query, string $format)
    {
        return $query->where('format', strtolower($format));
    }

    public function scopeLegal($query, bool $legal = true)
    {
        return $query->where('is_legal', $legal);
    }
}
