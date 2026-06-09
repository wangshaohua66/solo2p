<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    protected $fillable = [
        'name', 'email', 'password',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    public function collectionItems(): HasMany
    {
        return $this->hasMany(CollectionItem::class);
    }

    public function decks(): HasMany
    {
        return $this->hasMany(Deck::class);
    }

    public function matchRecords(): HasMany
    {
        return $this->hasMany(MatchRecord::class);
    }
}
