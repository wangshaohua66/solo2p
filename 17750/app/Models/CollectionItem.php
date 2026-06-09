<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @OA\Schema(
 *     schema="CollectionItem",
 *     type="object",
 *     title="CollectionItem",
 *     description="Collection Item",
 *     @OA\Property(property="id", type="integer", example=1),
 *     @OA\Property(property="card_id", type="integer", example=1),
 *     @OA\Property(property="quantity", type="integer", example=4),
 *     @OA\Property(property="condition", type="string", example="NM"),
 *     @OA\Property(property="language", type="string", example="en"),
 *     @OA\Property(property="is_foil", type="boolean", example=false)
 * )
 */
class CollectionItem extends Model
{
    use HasFactory;

    const CONDITIONS = ['NM', 'SP', 'MP', 'HP', 'DMG'];

    protected $fillable = [
        'card_id', 'quantity', 'language', 'condition',
        'is_foil', 'is_signed', 'is_altered',
        'purchase_price', 'purchase_source', 'purchase_date', 'notes',
    ];

    protected $casts = [
        'is_foil' => 'boolean',
        'is_signed' => 'boolean',
        'is_altered' => 'boolean',
        'purchase_date' => 'datetime',
        'purchase_price' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    public function scopeByCondition($query, string $condition)
    {
        return $query->where('condition', strtoupper($condition));
    }

    public function scopeFoil($query, bool $foil = true)
    {
        return $query->where('is_foil', $foil);
    }

    public function scopeByLanguage($query, string $language)
    {
        return $query->where('language', $language);
    }

    public function getCurrentValueAttribute(): float
    {
        $price = $this->is_foil ? $this->card?->price_usd_foil ?? $this->card?->price_usd : $this->card?->price_usd;
        return (float) ($price * $this->quantity);
    }
}
