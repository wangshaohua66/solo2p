<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @OA\Schema(
 *     schema="PriceHistory",
 *     type="object",
 *     title="PriceHistory",
 *     description="Price History",
 *     @OA\Property(property="id", type="integer", example=1),
 *     @OA\Property(property="card_id", type="integer", example=1),
 *     @OA\Property(property="price_usd", type="number", format="float", example=25.50),
 *     @OA\Property(property="price_eur", type="number", format="float", example=23.00),
 *     @OA\Property(property="price_date", type="string", format="date", example="2024-01-15")
 * )
 */
class PriceHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'card_id', 'price_usd', 'price_eur', 'price_tix',
        'source', 'price_date',
    ];

    protected $casts = [
        'price_usd' => 'decimal:2',
        'price_eur' => 'decimal:2',
        'price_tix' => 'decimal:2',
        'price_date' => 'date',
    ];

    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    public function scopeByCard($query, int $cardId)
    {
        return $query->where('card_id', $cardId);
    }

    public function scopeByDateRange($query, $start, $end)
    {
        return $query->whereBetween('price_date', [$start, $end]);
    }

    public function scopeLatest($query, $limit = 30)
    {
        return $query->orderBy('price_date', 'desc')->limit($limit);
    }

    public function getPriceChangeAttribute(): float
    {
        $previous = static::where('card_id', $this->card_id)
            ->where('price_date', '<', $this->price_date)
            ->orderBy('price_date', 'desc')
            ->first();

        if (! $previous) {
            return 0;
        }

        return (float) ($this->price_usd - $previous->price_usd);
    }

    public function getPriceChangePercentAttribute(): float
    {
        $previous = static::where('card_id', $this->card_id)
            ->where('price_date', '<', $this->price_date)
            ->orderBy('price_date', 'desc')
            ->first();

        if (! $previous || $previous->price_usd == 0) {
            return 0;
        }

        return (float) ((($this->price_usd - $previous->price_usd) / $previous->price_usd) * 100);
    }
}
