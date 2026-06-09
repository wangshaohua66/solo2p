<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

/**
 * @OA\Schema(
 *     schema="Card",
 *     type="object",
 *     title="Card",
 *     description="Magic: The Gathering Card",
 *     @OA\Property(property="id", type="integer", example=1),
 *     @OA\Property(property="scryfall_id", type="string", example="abc123"),
 *     @OA\Property(property="name", type="string", example="Black Lotus"),
 *     @OA\Property(property="mana_cost", type="string", example="{0}"),
 *     @OA\Property(property="cmc", type="integer", example=0),
 *     @OA\Property(property="type_line", type="string", example="Artifact"),
 *     @OA\Property(property="rarity", type="string", example="rare"),
 *     @OA\Property(property="set_code", type="string", example="LEA"),
 *     @OA\Property(property="colors", type="array", @OA\Items(type="string")),
 *     @OA\Property(property="price_usd", type="number", format="float", example=10000.00)
 * )
 */
class Card extends Model
{
    use HasFactory;

    protected $fillable = [
        'scryfall_id', 'oracle_id', 'name', 'name_normalized',
        'oracle_text', 'mana_cost', 'cmc', 'colors', 'color_identity',
        'type_line', 'card_types', 'subtypes', 'supertypes',
        'rarity', 'set_code', 'set_name', 'collector_number',
        'language', 'is_foil', 'is_full_art', 'is_promo',
        'price_usd', 'price_eur', 'price_tix',
        'image_small', 'image_normal', 'image_large',
        'artist', 'power', 'toughness', 'loyalty',
        'legalities', 'keywords', 'flavor_text',
        'edhrec_rank', 'released_at',
    ];

    protected $casts = [
        'colors' => 'array',
        'color_identity' => 'array',
        'card_types' => 'array',
        'subtypes' => 'array',
        'supertypes' => 'array',
        'legalities' => 'array',
        'keywords' => 'array',
        'is_foil' => 'boolean',
        'is_full_art' => 'boolean',
        'is_promo' => 'boolean',
        'released_at' => 'datetime',
    ];

    public function collectionItems(): HasMany
    {
        return $this->hasMany(CollectionItem::class);
    }

    public function priceHistories(): HasMany
    {
        return $this->hasMany(PriceHistory::class);
    }

    public function deckCards(): HasMany
    {
        return $this->hasMany(DeckCard::class);
    }

    public function scopeByName($query, string $name)
    {
        $normalized = strtolower(trim($name));
        return $query->where('name_normalized', 'LIKE', "%{$normalized}%")
            ->orWhere(DB::raw('name COLLATE NOCASE'), 'LIKE', "%{$name}%");
    }

    public function scopeByColors($query, array $colors)
    {
        foreach ($colors as $color) {
            $query->whereJsonContains('colors', $color);
        }
        return $query;
    }

    public function scopeByType($query, string $type)
    {
        return $query->whereJsonContains('card_types', $type)
            ->orWhere('type_line', 'LIKE', "%{$type}%");
    }

    public function scopeByRarity($query, string $rarity)
    {
        return $query->where('rarity', strtolower($rarity));
    }

    public function scopeBySet($query, string $setCode)
    {
        return $query->where('set_code', strtoupper($setCode));
    }

    public function scopeByCmc($query, int $cmc, string $operator = '=')
    {
        return $query->where('cmc', $operator, $cmc);
    }

    public function scopeByOracleText($query, string $text)
    {
        $searchText = strtolower($text);
        return $query->where(DB::raw('oracle_text COLLATE NOCASE'), 'LIKE', "%{$searchText}%");
    }

    public function scopeLegalIn($query, string $format)
    {
        return $query->where("legalities->{$format}", 'legal');
    }
}
