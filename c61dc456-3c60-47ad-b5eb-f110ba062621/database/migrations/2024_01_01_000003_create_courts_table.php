<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venue_id')->constrained()->onDelete('cascade');
            $table->string('name', 50);
            $table->string('court_number', 20);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index('venue_id');
            $table->index('is_active');
            $table->unique(['venue_id', 'court_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courts');
    }
};
