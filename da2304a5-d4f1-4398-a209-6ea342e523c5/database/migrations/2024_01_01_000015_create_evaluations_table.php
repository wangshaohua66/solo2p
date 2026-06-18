<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('schedule_id');
            $table->tinyInteger('teaching_score');
            $table->tinyInteger('attitude_score');
            $table->tinyInteger('content_score');
            $table->decimal('overall_score', 3, 1);
            $table->text('comment')->nullable();
            $table->boolean('is_anonymous')->default(true);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->foreign('student_id')->references('id')->on('students')->onDelete('cascade');
            $table->foreign('schedule_id')->references('id')->on('schedules')->onDelete('cascade');
            $table->unique(['student_id', 'schedule_id']);
            $table->index('schedule_id');
            $table->index('student_id');
            $table->index('overall_score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluations');
    }
};
