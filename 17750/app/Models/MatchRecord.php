<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @OA\Schema(
 *     schema="MatchRecord",
 *     type="object",
 *     title="MatchRecord",
 *     description="Match Record",
 *     @OA\Property(property="id", type="integer", example=1),
 *     @OA\Property(property="deck_id", type="integer", example=1),
 *     @OA\Property(property="opponent_archetype", type="string", example="Azorius Control"),
 *     @OA\Property(property="format", type="string", example="standard"),
 *     @OA\Property(property="on_play", type="boolean", example=true),
 *     @OA\Property(property="is_winner", type="boolean", example=true),
 *     @OA\Property(property="game_wins", type="integer", example=2),
 *     @OA\Property(property="game_losses", type="integer", example=1)
 * )
 */
class MatchRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'deck_id', 'opponent_archetype', 'format', 'on_play',
        'is_winner', 'game_wins', 'game_losses', 'turn_count',
        'notes', 'key_cards', 'mulligan_count', 'played_at',
    ];

    protected $casts = [
        'on_play' => 'boolean',
        'is_winner' => 'boolean',
        'key_cards' => 'array',
        'mulligan_count' => 'array',
        'played_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function deck(): BelongsTo
    {
        return $this->belongsTo(Deck::class);
    }

    public function scopeByFormat($query, string $format)
    {
        return $query->where('format', strtolower($format));
    }

    public function scopeByDeck($query, int $deckId)
    {
        return $query->where('deck_id', $deckId);
    }

    public function scopeWins($query)
    {
        return $query->where('is_winner', true);
    }

    public function scopeLosses($query)
    {
        return $query->where('is_winner', false);
    }

    public function scopeByOpponent($query, string $archetype)
    {
        return $query->where('opponent_archetype', 'LIKE', "%{$archetype}%");
    }

    public function scopePlayedBetween($query, $start, $end)
    {
        return $query->whereBetween('played_at', [$start, $end]);
    }

    public function getResultAttribute(): string
    {
        return "{$this->game_wins}-{$this->game_losses}";
    }
}
