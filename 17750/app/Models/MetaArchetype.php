<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @OA\Schema(
 *     schema="MetaArchetype",
 *     type="object",
 *     title="MetaArchetype",
 *     description="Meta Archetype",
 *     @OA\Property(property="id", type="integer", example=1),
 *     @OA\Property(property="name", type="string", example="Rakdos Midrange"),
 *     @OA\Property(property="percentage", type="number", format="float", example=15.5),
 *     @OA\Property(property="win_rate", type="number", format="float", example=52.3),
 *     @OA\Property(property="color_identity", type="array", @OA\Items(type="string"))
 * )
 */
class MetaArchetype extends Model
{
    use HasFactory;

    protected $fillable = [
        'meta_snapshot_id', 'name', 'percentage', 'win_rate',
        'sample_size', 'color_identity',
    ];

    protected $casts = [
        'percentage' => 'decimal:2',
        'win_rate' => 'decimal:2',
        'color_identity' => 'array',
    ];

    public function metaSnapshot(): BelongsTo
    {
        return $this->belongsTo(MetaSnapshot::class);
    }
}
