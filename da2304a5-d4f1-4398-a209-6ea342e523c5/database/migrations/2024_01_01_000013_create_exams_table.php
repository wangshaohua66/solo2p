<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exams', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('schedule_id');
            $table->enum('exam_type', ['midterm', 'final', 'makeup']);
            $table->date('exam_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedBigInteger('classroom_id')->nullable();
            $table->enum('status', ['planned', 'in_progress', 'completed', 'cancelled'])->default('planned');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('schedule_id')->references('id')->on('schedules')->onDelete('cascade');
            $table->foreign('classroom_id')->references('id')->on('classrooms')->onDelete('set null');
            $table->index('schedule_id');
            $table->index('exam_date');
            $table->index('classroom_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exams');
    }
};
