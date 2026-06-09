<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('match_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('deck_id')->nullable()->constrained()->onDelete('set null');
            $table->string('opponent_archetype')->nullable();
            $table->string('format')->default('casual');
            $table->boolean('on_play')->default(true);
            $table->boolean('is_winner')->default(false);
            $table->integer('game_wins')->default(0);
            $table->integer('game_losses')->default(0);
            $table->integer('turn_count')->nullable();
            $table->text('notes')->nullable();
            $table->json('key_cards')->nullable();
            $table->json('mulligan_count')->nullable();
            $table->timestamp('played_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'played_at']);
            $table->index(['user_id', 'opponent_archetype']);
            $table->index(['user_id', 'deck_id']);
            $table->index(['user_id', 'format']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_records');
    }
};
