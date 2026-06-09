<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('card_id')->constrained()->onDelete('cascade');
            $table->decimal('price_usd', 10, 2)->nullable();
            $table->decimal('price_eur', 10, 2)->nullable();
            $table->decimal('price_tix', 10, 2)->nullable();
            $table->string('source')->default('scryfall');
            $table->date('price_date')->index();
            $table->timestamps();

            $table->index(['card_id', 'price_date']);
        });

        DB::statement("
            CREATE TABLE price_histories_2024 PARTITION OF price_histories
            FOR VALUES IN ('2024');
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('price_histories');
    }
};
