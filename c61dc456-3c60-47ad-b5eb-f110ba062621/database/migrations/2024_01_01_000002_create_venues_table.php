<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('venues', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('type', 30);
            $table->text('description')->nullable();
            $table->string('address', 255)->nullable();
            $table->string('contact_phone', 20)->nullable();
            $table->time('open_time');
            $table->time('close_time');
            $table->integer('slot_duration')->default(60);
            $table->decimal('base_price', 10, 2)->default(0);
            $table->decimal('peak_price', 10, 2)->default(0);
            $table->string('peak_hours', 255)->nullable();
            $table->integer('advance_booking_days')->default(7);
            $table->integer('daily_booking_limit')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index('type');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('venues');
    }
};
