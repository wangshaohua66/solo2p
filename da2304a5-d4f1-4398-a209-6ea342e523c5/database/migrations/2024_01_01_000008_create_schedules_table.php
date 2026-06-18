<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schedules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('course_id');
            $table->unsignedBigInteger('teacher_id');
            $table->unsignedBigInteger('classroom_id');
            $table->string('semester', 20);
            $table->tinyInteger('day_of_week');
            $table->tinyInteger('start_period');
            $table->tinyInteger('end_period');
            $table->string('weeks', 50);
            $table->boolean('is_locked')->default(false);
            $table->enum('status', ['draft', 'published', 'cancelled'])->default('draft');
            $table->timestamps();

            $table->foreign('course_id')->references('id')->on('courses')->onDelete('restrict');
            $table->foreign('teacher_id')->references('id')->on('teachers')->onDelete('restrict');
            $table->foreign('classroom_id')->references('id')->on('classrooms')->onDelete('restrict');
            $table->unique(['classroom_id', 'semester', 'day_of_week', 'start_period', 'end_period']);
            $table->index('course_id');
            $table->index('teacher_id');
            $table->index('semester');
            $table->index('day_of_week');
            $table->index(['teacher_id', 'semester', 'day_of_week', 'start_period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schedules');
    }
};
