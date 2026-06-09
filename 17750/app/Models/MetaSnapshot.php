<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @OA\Schema(
 *     schema="MetaSnapshot",
 *     type="object",
 *     title="MetaSnapshot",
 *     description="Meta Snapshot",
 *     @OA\Property(property="id", type="integer", example=1),
 *     @OA\Property(property="format", type="string", example="standard"),
 *     @OA\Property(property="snapshot_date", type="string", format="date", example="2024-01-15"),
 *     @OA\Property(property="total_decks", type="integer", example=1000),
 *     @OA\Property(property="meta_data", type="object")
 * )
 */
class MetaSnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'format', 'source', 'snapshot_date', 'total_decks',
        'meta_data', 'notes',
    ];

    protected $casts = [
        'meta_data' => 'array',
        'snapshot_date' => 'date',
    ];

    public function archetypes(): HasMany
    {
        return $this->hasMany(MetaArchetype::class)->orderBy('percentage', 'desc');
    }

    public function scopeByFormat($query, string $format)
    {
        return $query->where('format', strtolower($format));
    }

    public function scopeLatest($query, string $format = null)
    {
        if ($format) {
            $query->where('format', $format);
        }
        return $query->orderBy('snapshot_date', 'desc');
    }

    public function scopeByDateRange($query, $start, $end)
    {
        return $query->whereBetween('snapshot_date', [$start, $end]);
    }

    public function getTopArchetypesAttribute($limit = 10)
    {
        return $this->archetypes()->limit($limit)->get();
    }
}
