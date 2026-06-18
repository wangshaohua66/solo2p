<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_status_changes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('student_id');
            $table->enum('type', ['suspend', 'resume', 'withdraw', 'transfer']);
            $table->unsignedBigInteger('from_major_id')->nullable();
            $table->unsignedBigInteger('to_major_id')->nullable();
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->string('approved_by', 50)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->date('effective_date');
            $table->decimal('refund_amount', 10, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('student_id')->references('id')->on('students')->onDelete('cascade');
            $table->foreign('from_major_id')->references('id')->on('majors')->onDelete('set null');
            $table->foreign('to_major_id')->references('id')->on('majors')->onDelete('set null');
            $table->index('student_id');
            $table->index('type');
            $table->index('status');
            $table->index('effective_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_status_changes');
    }
};
