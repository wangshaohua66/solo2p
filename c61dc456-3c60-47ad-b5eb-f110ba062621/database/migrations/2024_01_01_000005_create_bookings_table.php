<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('venue_id')->constrained()->onDelete('cascade');
            $table->foreignId('court_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('time_slot_id')->constrained()->onDelete('cascade');
            $table->date('booking_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('booking_no', 32)->unique();
            $table->decimal('amount', 10, 2);
            $table->decimal('paid_amount', 10, 2)->default(0);
            $table->string('status', 20)->default('pending');
            $table->boolean('is_checked_in')->default(false);
            $table->timestamp('check_in_time')->nullable();
            $table->boolean('is_violation')->default(false);
            $table->text('violation_reason')->nullable();
            $table->timestamp('expires_at');
            $table->text('cancel_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            $table->index('user_id');
            $table->index('venue_id');
            $table->index('time_slot_id');
            $table->index('booking_date');
            $table->index('status');
            $table->index('booking_no');
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
