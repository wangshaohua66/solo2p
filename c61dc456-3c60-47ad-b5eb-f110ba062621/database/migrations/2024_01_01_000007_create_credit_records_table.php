<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('booking_id')->nullable()->constrained()->onDelete('set null');
            $table->string('type', 20);
            $table->integer('score_change');
            $table->integer('balance_before');
            $table->integer('balance_after');
            $table->string('reason', 255);
            $table->boolean('is_violation')->default(false);
            $table->boolean('is_blacklist_trigger')->default(false);
            $table->timestamps();
            $table->index('user_id');
            $table->index('booking_id');
            $table->index('type');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_records');
    }
};
