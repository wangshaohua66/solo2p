<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('time_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venue_id')->constrained()->onDelete('cascade');
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->integer('total_courts');
            $table->integer('booked_courts')->default(0);
            $table->decimal('price', 10, 2);
            $table->boolean('is_peak')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['venue_id', 'date']);
            $table->index(['date', 'start_time']);
            $table->unique(['venue_id', 'date', 'start_time']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_slots');
    }
};
