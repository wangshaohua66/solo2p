<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('decks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('format')->default('standard');
            $table->text('description')->nullable();
            $table->string('archetype')->nullable();
            $table->json('colors')->nullable();
            $table->boolean('is_legal')->default(false);
            $table->text('validation_errors')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'format']);
            $table->index(['user_id', 'is_legal']);
        });

        Schema::create('deck_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deck_id')->constrained()->onDelete('cascade');
            $table->foreignId('card_id')->constrained()->onDelete('cascade');
            $table->integer('quantity')->default(1);
            $table->boolean('is_sideboard')->default(false);
            $table->timestamps();

            $table->index(['deck_id', 'is_sideboard']);
            $table->index(['deck_id', 'card_id']);
            $table->unique(['deck_id', 'card_id', 'is_sideboard']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deck_cards');
        Schema::dropIfExists('decks');
    }
};
