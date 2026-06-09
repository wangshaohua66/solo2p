<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collection_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('card_id')->constrained()->onDelete('cascade');
            $table->integer('quantity')->default(1);
            $table->string('language')->default('en');
            $table->string('condition')->default('NM');
            $table->boolean('is_foil')->default(false);
            $table->boolean('is_signed')->default(false);
            $table->boolean('is_altered')->default(false);
            $table->decimal('purchase_price', 10, 2)->nullable();
            $table->string('purchase_source')->nullable();
            $table->timestamp('purchase_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'card_id']);
            $table->index(['user_id', 'condition']);
            $table->index(['user_id', 'is_foil']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_items');
    }
};
